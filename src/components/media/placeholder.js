// A fully transparent GIF, used as the src of an <img> whose plaintext is still
// being fetched. Keeping a real <img> mounted throughout means the element,
// its layout and its decoded-image slot never change — swapping a placeholder
// <div> for an <img> forced a teardown and re-decode on every mount.
//
// 64×64 rather than the classic 1×1: where the caller constrains neither axis
// — the memory lightbox is `max-w-full max-h-full object-contain` — the element
// collapses to the placeholder's intrinsic size, and a 1px box has nowhere to
// paint a spinner and no presence on screen at all. These are the same bytes as
// the 1×1 GIF with only the logical screen widened; the single pixel stays the
// only frame, and everything it does not cover falls back to background colour
// index 0, which is the declared transparent index. Still empty, just 64px of it.
export const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhQABAAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// Applied alongside the caller's classes while nothing is decrypted yet. Paints
// the tint immediately and a spinner once the wait is long enough to notice —
// see `.media-decrypting` in index.css for why both live on one class.
export const PLACEHOLDER_CLASSES = 'media-decrypting'
