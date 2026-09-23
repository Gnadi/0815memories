/**
 * Small shared helpers for the print endpoints.
 *
 * Vercel's Node handlers are bare `(req, res)`, so every route would otherwise
 * repeat the same method guard, the same JSON parsing and the same shape of
 * error body. Keeping them here also keeps the error bodies uniform, which
 * matters more than it sounds: the client has to distinguish "you are not
 * allowed" from "the print network said no" from "we are misconfigured", and it
 * can only do that if every route says so the same way.
 */

/** Thrown by route code; `status` and `code` travel to the client, `detail` does not. */
export class ApiError extends Error {
  constructor(status, code, message, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export const badRequest = (code, message) => new ApiError(400, code, message)
export const unauthorized = (code = 'unauthorized', message = 'Authentication required') =>
  new ApiError(401, code, message)
export const forbidden = (code = 'forbidden', message = 'Not allowed') => new ApiError(403, code, message)
export const misconfigured = (message) => new ApiError(500, 'misconfigured', message)

export function methodGuard(req, res, allowed) {
  if (allowed.includes(req.method)) return true
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ error: { code: 'method_not_allowed', message: `Use ${allowed.join(' or ')}` } })
  return false
}

/**
 * Vercel parses JSON bodies itself, but only when the content type says so.
 * A client that posts without the header would otherwise land in route code
 * with a string, which reads as "field missing" and is a miserable thing to
 * debug from the browser.
 */
export function readJsonBody(req) {
  const body = req.body
  if (body == null || body === '') return {}
  if (typeof body === 'object') return body
  try {
    return JSON.parse(body)
  } catch {
    throw badRequest('invalid_json', 'Request body is not valid JSON')
  }
}

/**
 * Run a handler and turn anything it throws into a response.
 *
 * Deliberately narrow about what reaches the client: an ApiError's own code and
 * message, and nothing else. An unexpected exception becomes a flat 500 —
 * stack traces and upstream error bodies can carry the merchant key, a signed
 * URL or a customer address, and none of those belong in a browser.
 */
export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.detail) console.error(`[print] ${err.code}:`, err.detail)
        res.status(err.status).json({ error: { code: err.code, message: err.message } })
        return
      }
      console.error('[print] unhandled error:', err)
      res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } })
    }
  }
}
