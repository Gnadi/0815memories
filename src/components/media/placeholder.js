// 1×1 transparent GIF, used as the src of an <img> whose plaintext is still
// being fetched. Keeping a real <img> mounted throughout means the element,
// its layout and its decoded-image slot never change — swapping a placeholder
// <div> for an <img> forced a teardown and re-decode on every mount.
export const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// Applied alongside the caller's classes while nothing is decrypted yet.
export const PLACEHOLDER_CLASSES = 'bg-cream-dark animate-pulse'
