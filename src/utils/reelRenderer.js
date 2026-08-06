// Highlight video ("reel") rendering.
//
// A reel is a list of shots drawn onto a <canvas>: each photo is cover-cropped
// like a collage slot, given a slow Ken Burns push, and crossfaded into the
// next. The same canvas is both what the user watches in the app and what the
// download button records, so playback and export can never drift apart.
//
// Recording uses MediaRecorder over canvas.captureStream(). That is not
// available everywhere (older iOS Safari has neither), which is why
// canRecordReel() exists — the UI hides "Download video" rather than offering a
// button that throws.

import { ASPECTS, DEFAULT_ASPECT } from '../components/collage/collageTemplates'
import { computeCoverRect } from './collageRenderer'
import { prefetchDecryptedMedia } from '../components/media/useDecryptedMedia'

export const DEFAULT_SHOT_MS = 2600
export const DEFAULT_TRANSITION_MS = 600
export const MIN_SHOT_MS = 1000
export const MAX_SHOT_MS = 6000
export const TITLE_CARD_MS = 2200
export const REEL_FPS = 30

export const REEL_THEMES = [
  { id: 'warm', background: '#2D1B0E', text: '#FFFDF9', accent: '#D4784A' },
  { id: 'cream', background: '#FDF6EC', text: '#2D1B0E', accent: '#C25A2E' },
  { id: 'night', background: '#0F0F0F', text: '#FFFFFF', accent: '#A8C7FA' },
  { id: 'forest', background: '#1B4332', text: '#F0FFF4', accent: '#95D5B2' },
]

export function getTheme(themeId) {
  return REEL_THEMES.find((t) => t.id === themeId) || REEL_THEMES[0]
}

export function reelSize(aspect, width) {
  const ratio = ASPECTS[aspect] ?? ASPECTS[DEFAULT_ASPECT]
  // Even dimensions: some encoders reject odd ones.
  const height = Math.round(width / ratio / 2) * 2
  return { width: Math.round(width / 2) * 2, height }
}

/**
 * Lay the shots out on a shared clock. Consecutive segments overlap by
 * `transitionMs` — that overlap *is* the crossfade, so the reel is shorter than
 * the sum of its shots.
 *
 * Pure; the player and the recorder both read from what this returns.
 */
export function buildTimeline(shots, { transitionMs = DEFAULT_TRANSITION_MS, titleCard = null } = {}) {
  const segments = []
  if (titleCard?.text) {
    segments.push({ kind: 'title', durationMs: TITLE_CARD_MS, titleCard })
  }
  for (const shot of shots || []) {
    segments.push({
      kind: 'photo',
      durationMs: clampDuration(shot.durationMs),
      shot,
    })
  }

  const fade = Math.max(0, transitionMs)
  let cursor = 0
  const entries = segments.map((segment, index) => {
    const start = cursor
    const end = start + segment.durationMs
    // The next segment starts `fade` before this one ends.
    cursor = end - (index < segments.length - 1 ? Math.min(fade, segment.durationMs / 2) : 0)
    return { ...segment, index, start, end }
  })

  return {
    entries,
    transitionMs: fade,
    durationMs: entries.length ? entries[entries.length - 1].end : 0,
  }
}

function clampDuration(ms) {
  const value = Number(ms) || DEFAULT_SHOT_MS
  return Math.min(MAX_SHOT_MS, Math.max(MIN_SHOT_MS, value))
}

/**
 * Which segments are on screen at time `t`, and how opaque each one is.
 */
export function frameAt(timeline, t) {
  const fade = timeline.transitionMs
  const active = []
  for (const entry of timeline.entries) {
    if (t < entry.start || t >= entry.end) continue
    const elapsed = t - entry.start
    const remaining = entry.end - t
    let alpha = 1
    // Fade in every segment but the first, fade out every one but the last.
    if (fade > 0 && entry.index > 0 && elapsed < fade) alpha = elapsed / fade
    if (fade > 0 && entry.index < timeline.entries.length - 1 && remaining < fade) {
      alpha = Math.min(alpha, remaining / fade)
    }
    active.push({ entry, alpha: Math.max(0, Math.min(1, alpha)), progress: elapsed / entry.durationMs })
  }
  return active
}

// Deterministic Ken Burns move per segment: alternate push-in and pull-out with
// a small drift, so a reel does not look mechanical but still replays the same.
function kenBurns(index, progress) {
  const inward = index % 2 === 0
  const from = inward ? 1.0 : 1.12
  const to = inward ? 1.12 : 1.0
  const scale = from + (to - from) * progress
  const driftX = ((index % 3) - 1) * 0.18 * progress
  const driftY = ((index % 2) === 0 ? 0.12 : -0.12) * progress
  return { scale, offsetX: driftX, offsetY: driftY }
}

/**
 * Draw one frame of the reel.
 */
export function drawReelFrame(ctx, doc, images, timeline, t, { width, height }) {
  const theme = getTheme(doc?.theme)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, width, height)

  for (const { entry, alpha, progress } of frameAt(timeline, t)) {
    ctx.save()
    ctx.globalAlpha = alpha

    if (entry.kind === 'title') {
      drawTitleCard(ctx, entry.titleCard, theme, { width, height })
    } else {
      const img = entry.shot?.url ? images?.get?.(entry.shot.url) : null
      if (img) {
        const { scale, offsetX, offsetY } = kenBurns(entry.index, progress)
        const iw = img.naturalWidth ?? img.width
        const ih = img.naturalHeight ?? img.height
        const { sx, sy, sw, sh } = computeCoverRect(iw, ih, width, height, scale, offsetX, offsetY)
        if (sw && sh) ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
      }
    }

    ctx.restore()
  }
}

function drawTitleCard(ctx, titleCard, theme, { width, height }) {
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, width, height)

  const titleSize = Math.round(width * 0.11)
  const subSize = Math.round(width * 0.05)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = theme.text
  ctx.font = `700 ${titleSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  wrapText(ctx, titleCard.text || '', width / 2, height / 2, width * 0.84, titleSize * 1.2)

  if (titleCard.subtitle) {
    ctx.fillStyle = theme.accent
    ctx.font = `500 ${subSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.fillText(titleCard.subtitle, width / 2, height / 2 + titleSize * 1.4, width * 0.84)
  }
}

function wrapText(ctx, text, cx, cy, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText?.(candidate)?.width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)

  const startY = cy - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight, maxWidth))
}

/**
 * Play a reel on a canvas. Returns a controller; call stop() to cancel (the
 * player component does that on unmount and when the user pauses).
 */
export function playReel(canvas, doc, images, timeline, { onProgress, onEnded, startAt = 0 } = {}) {
  const ctx = canvas.getContext('2d')
  const size = { width: canvas.width, height: canvas.height }
  let raf = null
  let stopped = false
  const began = now() - startAt

  const tick = () => {
    if (stopped) return
    const t = now() - began
    drawReelFrame(ctx, doc, images, timeline, Math.min(t, timeline.durationMs), size)
    onProgress?.(Math.min(t, timeline.durationMs))
    if (t >= timeline.durationMs) {
      stopped = true
      onEnded?.()
      return
    }
    raf = requestAnimationFrame(tick)
  }

  tick()

  return {
    stop() {
      stopped = true
      if (raf != null) cancelAnimationFrame(raf)
    },
    get stopped() {
      return stopped
    },
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

const CANDIDATE_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]

/**
 * The best container this browser can actually record, or null when it cannot
 * record at all.
 */
export function pickRecorderMimeType() {
  if (typeof window === 'undefined') return null
  const Recorder = window.MediaRecorder
  if (typeof Recorder !== 'function') return null
  if (typeof Recorder.isTypeSupported !== 'function') return CANDIDATE_MIME_TYPES[2]
  return CANDIDATE_MIME_TYPES.find((type) => Recorder.isTypeSupported(type)) || null
}

export function canRecordReel() {
  if (typeof HTMLCanvasElement === 'undefined') return false
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false
  return pickRecorderMimeType() != null
}

export function recordedFileExtension(mimeType) {
  return mimeType?.startsWith('video/mp4') ? 'mp4' : 'webm'
}

/**
 * Render the reel in real time into a video file.
 *
 * Real time is not a shortcut we can skip: MediaRecorder samples a live canvas
 * stream, so a 20-second reel takes 20 seconds to produce. The caller shows
 * progress from `onProgress`.
 */
export function recordReel(canvas, doc, images, timeline, { onProgress } = {}) {
  const mimeType = pickRecorderMimeType()
  if (!mimeType) return Promise.reject(new Error('Recording is not supported in this browser'))

  return new Promise((resolve, reject) => {
    let stream
    try {
      stream = canvas.captureStream(REEL_FPS)
    } catch (err) {
      reject(err)
      return
    }

    const recorder = new window.MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = (event) => {
      player.stop()
      reject(event.error || new Error('Recording failed'))
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType })
    }

    const player = playReel(canvas, doc, images, timeline, {
      onProgress,
      onEnded: () => {
        // One last frame is already drawn; give the encoder a beat to pick it
        // up before closing the file, otherwise the reel ends a frame early.
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop()
        }, 1000 / REEL_FPS)
      },
    })

    recorder.start()
  })
}

/**
 * Decrypt every photo a reel references. Same contract as loadSlotImages.
 */
export async function loadReelImages(shots, encryptionKey) {
  const urls = [...new Set((shots || []).map((s) => s.url).filter(Boolean))]
  const entries = await Promise.all(urls.map(async (url) => {
    try {
      const resolved = (await prefetchDecryptedMedia(url, encryptionKey, 'image/*')) || url
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Image load failed'))
        image.src = resolved
      })
      return [url, img]
    } catch {
      return null
    }
  }))
  return new Map(entries.filter(Boolean))
}

/**
 * A fresh reel document.
 */
export function makeHighlightDoc({ shots = [], title = '', subtitle = '', aspect = '9:16', theme = 'warm' } = {}) {
  return {
    aspect,
    theme,
    transitionMs: DEFAULT_TRANSITION_MS,
    titleCard: { text: title, subtitle },
    shots: shots.map((shot) => ({
      url: shot.url,
      thumbUrl: shot.thumbUrl || null,
      memoryId: shot.memoryId || null,
      durationMs: DEFAULT_SHOT_MS,
    })),
  }
}
