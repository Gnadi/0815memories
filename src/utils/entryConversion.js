/**
 * Mapping between the two post types, used when the "Memory / Moment" switch is
 * flipped in a post modal. Each function turns the modal's current, plaintext
 * form state into a draft the other modal can open with — shaped like a stored
 * document, so the modals seed their media from it the same way they do on edit.
 *
 * `thumbsTiny` is not carried over. The copies held in the form are decrypted,
 * and writing them back would put the previews in clear; an ordinary edit drops
 * them for the same reason, and the backfill restores them.
 */

function mediaDraft(images, videos) {
  const ready = images.filter((img) => img.url)
  const thumbs = ready.map((img) => img.thumbUrl || '')
  return {
    images: ready.map((img) => img.url),
    ...(thumbs.some(Boolean) ? { thumbs } : {}),
    videos: videos
      .filter((v) => v.url)
      .map((v) => ({ url: v.url, publicId: v.publicId, title: v.title || '' })),
  }
}

/**
 * Memory form → moment draft. A moment has one caption, so the title and the
 * story's plain text are joined into it; voice memos, the quote and the rich
 * formatting have nowhere to go.
 */
export function memoryFormToMomentDraft({ form, storyText, images, videos }) {
  return {
    caption: [form.title, storyText].map((s) => (s || '').trim()).filter(Boolean).join('\n\n'),
    category: form.category || '',
    location: form.location || '',
    label: '',
    ...mediaDraft(images, videos),
  }
}

/**
 * Moment form → memory draft. The caption's first line becomes the title (a
 * memory requires one) and the rest becomes the story.
 */
export function momentFormToMemoryDraft({ form, images, videos, date }) {
  const caption = (form.caption || '').trim()
  const [firstLine = '', ...rest] = caption.split('\n')
  return {
    title: firstLine.trim(),
    content: rest.join('\n').trim(),
    category: form.category || '',
    location: form.location || '',
    ...(date ? { date } : {}),
    ...mediaDraft(images, videos),
  }
}
