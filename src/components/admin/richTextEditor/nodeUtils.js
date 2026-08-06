/**
 * Locating and updating a media node after its upload resolves.
 *
 * The node is inserted the instant the file is picked, long before the upload
 * finishes, so the attributes have to be filled in later. Two things matter
 * here and both are easy to get wrong:
 *
 *  - the editor state must be read at resolve time, never closed over, because
 *    the user has been typing while the upload ran and every position has moved;
 *  - the patch must not enter the undo history, or one Ctrl-Z after an upload
 *    would revert the node to its empty, pending state.
 */

/** Find a node by its transient uploadId. Returns null once it is gone. */
export function findByUploadId(editor, uploadId) {
  if (!editor || editor.isDestroyed || !uploadId) return null
  let hit = null
  editor.state.doc.descendants((node, pos) => {
    if (hit) return false
    if (node.attrs?.uploadId === uploadId) {
      hit = { node, pos }
      return false
    }
    return true
  })
  return hit
}

/**
 * Merge attributes into the node carrying `uploadId`. Returns false when the
 * node no longer exists — the user is free to delete a placeholder while its
 * upload is still running, and that is not an error.
 */
export function patchByUploadId(editor, uploadId, attrs) {
  const hit = findByUploadId(editor, uploadId)
  if (!hit) return false
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, ...attrs })
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  return true
}

/** Remove the node carrying `uploadId` — used when an upload fails. */
export function removeByUploadId(editor, uploadId) {
  const hit = findByUploadId(editor, uploadId)
  if (!hit) return false
  const tr = editor.state.tr.delete(hit.pos, hit.pos + hit.node.nodeSize)
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  return true
}

let counter = 0
export function newUploadId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `upl-${crypto.randomUUID()}`
  return `upl-${Date.now()}-${counter++}`
}
