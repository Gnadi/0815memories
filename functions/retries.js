/**
 * Retried triggers, and when to stop retrying.
 *
 * A Firestore trigger is delivered at least once, but a run that throws is
 * dropped unless the function asks for retries. The triggers that keep
 * something in step with the documents — the media ledger, admin claims, the
 * public mirror — ask for them: a dropped run there leaves the two sides
 * disagreeing until the document happens to be written again. They can, because
 * each decides from the document as it is now, so a second run lands on the
 * same answer.
 *
 * Retries go on for up to a week, and a run that fails every time (a bug, a
 * document nothing can process) would be billed for all of it. An event older
 * than this is given up instead, loudly.
 */
export const RETRY_FOR_MS = 60 * 60 * 1000

/**
 * Has this event been retried for long enough? `event.time` is when the
 * document was written, the same on every delivery. An event without a
 * readable time is run: giving up is the choice that needs a reason.
 */
export function givenUp(event, now = Date.now()) {
  const written = Date.parse(event?.time)
  return Number.isFinite(written) && now - written > RETRY_FOR_MS
}
