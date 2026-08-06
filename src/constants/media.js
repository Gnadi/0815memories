// Maximum duration for inline short-form videos (moments, memories, black box).
// Applied client-side before upload so oversized clips never hit Cloudinary.
export const MAX_VIDEO_DURATION_SECONDS = 60

// Every encrypted asset — photo, video, voice memo — is stored as a Cloudinary
// `raw` resource, because ciphertext is not a decodable image or video. Raw
// resources carry their own per-plan size cap (10 MB on the free tier), far
// below the 100 MB video cap, and Cloudinary rejects anything above it with a
// 400. A 13-second phone clip passes the duration check and then dies on that
// cap, so size has to be checked as well as length.
//
// Set VITE_CLOUDINARY_MAX_UPLOAD_BYTES to your plan's raw limit after upgrading.
export const MAX_UPLOAD_BYTES =
  Number(import.meta.env?.VITE_CLOUDINARY_MAX_UPLOAD_BYTES) || 10 * 1024 * 1024

// AES-GCM adds a 12-byte IV prefix and a 16-byte auth tag, so the ciphertext we
// actually POST is slightly larger than the file the user picked.
export const ENCRYPTION_OVERHEAD_BYTES = 28

// The largest plaintext that still fits under MAX_UPLOAD_BYTES once encrypted.
export const MAX_PLAINTEXT_BYTES = MAX_UPLOAD_BYTES - ENCRYPTION_OVERHEAD_BYTES

// Human-readable size for error messages. Deliberately coarse — the point is
// "your clip is 24 MB and the limit is 10 MB", not byte-exact accounting.
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  // One decimal below 10 MB, whole numbers above — and the limit itself, which
  // sits 28 bytes under 10 MB, must read as "10 MB" rather than "10.0 MB".
  const rounded = Math.round(mb * 10) / 10
  return rounded >= 10 ? `${Math.round(rounded)} MB` : `${rounded.toFixed(1)} MB`
}
