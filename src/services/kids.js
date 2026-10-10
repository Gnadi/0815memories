/**
 * The family's children, whom the journals, the birth sky and the Vault are
 * written for.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptFields, encryptFields } from '../utils/encryption'
import { subscribeDecrypted } from './decrypted'

const CHILDREN = 'children'

// birthTime ("04:17") and birthPlace (JSON: name, country, lat, lon, tz) feed
// the "Sky of your birth" map. Both are encrypted: together with the birthdate
// they say exactly when and where a child was born.
export const KID_ENCRYPTED_FIELDS = ['name', 'birthTime', 'birthPlace']

// The fields an update clears by passing null: the birth sky's "not known".
const CLEARABLE_FIELDS = ['birthTime', 'birthPlace']

function parseBirthPlace(value) {
  if (!value || typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// A plain place object becomes a JSON string so encryptFields can encrypt it.
// Anything else — a string, or null — passes through untouched.
function serialize(kid) {
  const place = kid.birthPlace
  if (place && Object.getPrototypeOf(place) === Object.prototype) {
    return { ...kid, birthPlace: JSON.stringify(kid.birthPlace) }
  }
  return kid
}

export async function decryptKid(key, data) {
  const kid = await decryptFields(key, data, KID_ENCRYPTED_FIELDS)
  return { ...kid, birthPlace: parseBirthPlace(kid.birthPlace) }
}

/** The family's children, oldest entry first. */
export function subscribeKids(familyId, key, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, CHILDREN), where('familyId', '==', familyId), orderBy('createdAt', 'asc')),
    (docs) => Promise.all(docs.map((d) => decryptKid(key, d))),
    onData,
    onError,
  )
}

export async function addKid(familyId, key, kid) {
  const encrypted = await encryptFields(key, serialize(kid), KID_ENCRYPTED_FIELDS)
  await addDoc(collection(db, CHILDREN), {
    ...encrypted,
    familyId,
    createdAt: serverTimestamp(),
  })
}

/** `null` for birthTime or birthPlace removes it. */
export async function updateKid(key, id, updates) {
  const encrypted = await encryptFields(key, serialize(updates), KID_ENCRYPTED_FIELDS)
  for (const field of CLEARABLE_FIELDS) {
    if (encrypted[field] === null) encrypted[field] = deleteField()
  }
  await updateDoc(doc(db, CHILDREN, id), encrypted)
}

export async function deleteKid(id) {
  await deleteDoc(doc(db, CHILDREN, id))
}
