import { MAX_PLAINTEXT_BYTES } from '../constants/media'
import { uploadTooLargeError } from './encryptedUpload'
import { devError } from './devLog'

// Phones film at 15–50 Mbit/s, so a clip passes the duration cap and still
// overshoots Cloudinary's 10 MB raw cap after a few seconds. Clips above the
// limit are re-encoded on the device before they are encrypted, with the
// browser's own encoders (WebCodecs, hardware-accelerated on most phones), so
// nothing leaves the device unencrypted and nothing is sent twice.

// The encoder only aims at a bitrate; hardware encoders in particular land a
// few percent either side of it. Aiming below the limit leaves room for that
// and for the MP4 container's own bytes.
const TARGET_SHARE = 0.85

// 720p is plenty for a family feed watched on phones, and at the ~1 Mbit/s a
// full minute is left with, a larger frame would only look worse.
const MAX_LONG_SIDE = 1280

// Above this a 720p clip gains nothing visible, and a short clip just over the
// limit would otherwise be re-encoded at an absurd bitrate.
const MAX_VIDEO_BITRATE = 4_000_000

// Below this the picture falls apart into blocks; refusing is kinder than
// uploading mush. Only reached when the sound track eats most of the budget.
const MIN_VIDEO_BITRATE = 250_000

// Used when the sound track's own bitrate cannot be read. Phone cameras record
// AAC at 96–256 kbit/s; assuming the high end keeps the result under the limit.
const FALLBACK_AUDIO_BITRATE = 256_000

// The video bitrate that brings a clip of `durationSec` with a sound track of
// `audioBitrate` under `limitBytes`, or 0 when no usable bitrate does.
export function videoBitrateFor(durationSec, audioBitrate, limitBytes = MAX_PLAINTEXT_BYTES) {
  if (!(durationSec > 0)) return 0
  const total = (limitBytes * 8 * TARGET_SHARE) / durationSec
  const video = Math.min(MAX_VIDEO_BITRATE, Math.floor(total - audioBitrate))
  return video >= MIN_VIDEO_BITRATE ? video : 0
}

// Scales only the long side, so the other follows the aspect ratio, and never
// up: a small clip that is large only because of its bitrate keeps its size.
export function outputDimensions(displayWidth, displayHeight) {
  if (Math.max(displayWidth, displayHeight) <= MAX_LONG_SIDE) return {}
  return displayWidth >= displayHeight ? { width: MAX_LONG_SIDE } : { height: MAX_LONG_SIDE }
}

export function canCompressVideo() {
  return typeof globalThis.VideoEncoder === 'function' && typeof globalThis.VideoDecoder === 'function'
}

async function encodeOnce(mb, file, { bitrate, dimensions, onProgress }) {
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  try {
    const target = new mb.BufferTarget()
    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    })
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: {
        ...dimensions,
        codec: 'avc',
        quality: new mb.Quality({ bitrate }),
      },
      // The sound is copied as it is rather than re-encoded. Browsers without
      // an AAC encoder (Chromium without proprietary codecs, for one) would
      // otherwise drop it, and it is a small part of the file anyway.
      showWarnings: false,
    })
    // A clip without its sound, or without its picture, is not the clip the
    // person picked. Better to say it is too large than to upload that.
    if (!conversion.isValid || conversion.discardedTracks.length > 0) {
      const reasons = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`)
      throw new Error(`Video cannot be converted here (${reasons.join(', ') || 'invalid'})`)
    }
    if (onProgress) conversion.onProgress = (p) => onProgress(Math.min(1, Math.max(0, p)))
    await conversion.execute()
    return new Blob([target.buffer], { type: 'video/mp4' })
  } finally {
    input.dispose()
  }
}

async function compress(file, { limit, onProgress }) {
  const mb = await import('mediabunny')
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  let duration, dimensions, audioBitrate
  try {
    const videoTrack = await input.getPrimaryVideoTrack()
    if (!videoTrack) throw new Error('No video track')
    duration = await input.computeDuration()
    dimensions = outputDimensions(videoTrack.displayWidth, videoTrack.displayHeight)
    const audioTrack = await input.getPrimaryAudioTrack()
    audioBitrate = 0
    if (audioTrack) {
      const stats = await audioTrack.computePacketStats(200).catch(() => null)
      audioBitrate = stats?.averageBitrate > 0 ? stats.averageBitrate : FALLBACK_AUDIO_BITRATE
    }
  } finally {
    input.dispose()
  }

  let bitrate = videoBitrateFor(duration, audioBitrate, limit)
  if (!bitrate) throw new Error('No bitrate fits this clip under the limit')

  let result = await encodeOnce(mb, file, { bitrate, dimensions, onProgress })
  if (result.size <= limit) return result

  // The encoder overshot. Once more, aiming as far below as it went over.
  bitrate = Math.floor(bitrate * ((limit * TARGET_SHARE) / result.size))
  if (bitrate < MIN_VIDEO_BITRATE) throw new Error('Encoder overshoots the limit')
  onProgress?.(0)
  result = await encodeOnce(mb, file, { bitrate, dimensions, onProgress })
  if (result.size <= limit) return result
  throw new Error(`Compressed clip is still ${result.size} bytes`)
}

/**
 * Returns `file` itself when it already fits under the upload limit, or an
 * MP4 re-encoded on this device that does. `onProgress` gets 0…1 while it
 * works. Throws the usual upload/too-large error when the browser cannot do it
 * (no WebCodecs, an undecodable format) or the result would not fit, so callers
 * show the same message as before compression existed.
 */
export async function fitVideoToLimit(file, { limit = MAX_PLAINTEXT_BYTES, onProgress } = {}) {
  if (file.size <= limit) return file
  if (!canCompressVideo()) throw uploadTooLargeError(file.size, limit)
  try {
    return await compress(file, { limit, onProgress })
  } catch (err) {
    devError('Video compression failed:', err)
    throw uploadTooLargeError(file.size, limit)
  }
}
