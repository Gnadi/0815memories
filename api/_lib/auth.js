/**
 * Who is allowed to spend money.
 *
 * These endpoints hold the merchant key that places print orders. An
 * unauthenticated one is not a leak waiting to happen — it *is* the leak: anyone
 * who finds the URL can have books printed and shipped on the operator's
 * account. `api/cloudinary-sign` gets away without a check because the worst it
 * hands out is an upload slot; an order endpoint does not.
 *
 * Verification goes straight to Google's public keys rather than through
 * firebase-admin. The admin SDK would need a service-account secret in Vercel
 * for a job that needs no privilege at all — reading a signature — and every
 * secret that exists is a secret that can leak. The project id is enough.
 *
 * Both kinds of session end up here as ordinary Firebase ID tokens: admins sign
 * in with Firebase Auth directly, viewers exchange the custom token minted by
 * `viewerLogin` for one. Both carry the `familyId` and `role` claims that
 * `syncAdminClaims` and `viewerLogin` set, which is what firestore.rules and
 * storage.rules key off too — so this check and those rules agree by
 * construction rather than by coincidence.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { forbidden, misconfigured, unauthorized } from './http.js'

// Google's public keys for Firebase ID tokens, in JWK form. `jose` caches the
// set and refreshes it on an unknown key id, so this is one fetch per cold
// start rather than one per request.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

function projectId() {
  // Vercel exposes the build-time VITE_ vars to functions too; FIREBASE_PROJECT_ID
  // is accepted as well so the server can be configured without the client's
  // naming leaking into it.
  const id = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
  if (!id) throw misconfigured('FIREBASE_PROJECT_ID is not set')
  return id
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer (.+)$/i.exec(String(header).trim())
  if (!match) throw unauthorized('missing_token', 'Missing bearer token')
  return match[1]
}

/**
 * Verify the caller's Firebase ID token and return its identity claims.
 *
 * Throws rather than returning null: a caller that forgets to check a return
 * value gets a 401, not an order.
 */
export async function verifyIdToken(req) {
  const id = projectId()
  const token = bearerToken(req)

  let payload
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${id}`,
      audience: id,
      algorithms: ['RS256'],
    }))
  } catch {
    // Deliberately one message for every reason a token can fail — expired,
    // wrong audience, bad signature. Telling a caller which one they got wrong
    // helps nobody who is entitled to be here.
    throw unauthorized('invalid_token', 'Token is not valid')
  }

  // `sub` is the uid. Firebase always sets it; a token without one is not a
  // token we know how to attribute an order to.
  if (!payload.sub) throw unauthorized('invalid_token', 'Token has no subject')

  return {
    uid: String(payload.sub),
    familyId: payload.familyId ? String(payload.familyId) : null,
    role: payload.role ? String(payload.role) : null,
  }
}

/**
 * Verify the caller is an admin of the family they claim to be acting for.
 *
 * Admin-only, matching storage.rules and firestore.rules: a viewer holds the
 * shared family password, which is not the same as authority to spend the
 * operator's money.
 */
export async function requireFamilyAdmin(req, familyId) {
  const identity = await verifyIdToken(req)

  if (identity.role !== 'admin') {
    throw forbidden('not_an_admin', 'Only family admins can order prints')
  }
  if (!identity.familyId) {
    throw forbidden('no_family', 'Token carries no family')
  }
  // The family is taken from the token, never from the request body — but when
  // the body names one too, a mismatch means the client is confused or someone
  // is probing, and neither should quietly succeed against the wrong family.
  if (familyId && familyId !== identity.familyId) {
    throw forbidden('family_mismatch', 'Token does not belong to that family')
  }

  return identity
}
