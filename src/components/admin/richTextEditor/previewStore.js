/**
 * Local blob: previews for media that is still uploading.
 *
 * The point of keeping these out of the document: a `blob:` URL is only valid
 * for the lifetime of the tab. If one were ever persisted to Firestore it would
 * produce a permanently broken memory, and no amount of save-time filtering can
 * fully rule that out once the URL is an attribute someone might copy, undo or
 * paste around.
 *
 * So the node carries `{ src: '', uploadId }` while the upload is in flight and
 * the NodeView looks the preview up here by id. Persisting a blob: URL is then
 * structurally impossible rather than merely guarded against.
 */

const previews = new Map()

export function setPreview(uploadId, objectUrl) {
  if (!uploadId) return
  clearPreview(uploadId)
  previews.set(uploadId, objectUrl)
}

export function getPreview(uploadId) {
  return uploadId ? previews.get(uploadId) : undefined
}

export function clearPreview(uploadId) {
  const url = previews.get(uploadId)
  if (url) URL.revokeObjectURL(url)
  previews.delete(uploadId)
}

/** Called when the editor unmounts, so no object URL outlives its editor. */
export function clearAllPreviews() {
  for (const url of previews.values()) URL.revokeObjectURL(url)
  previews.clear()
}
