/**
 * What the best-of knows about a photo, found out in the browser: how sharp,
 * how bright, how colourful, how many faces and how wide the widest smile.
 * utils/bestOf.js turns these into its choices — the month's best photos and
 * awards like the biggest smile.
 *
 * It has to happen here. The photos are encrypted, so no server could look at
 * them, and none should: the decrypted photo stays in this tab, and what is
 * kept of it is the five numbers above, stored with the best-of — encrypted.
 */
import { prefetchDecryptedMedia } from '../components/media/useDecryptedMedia'

// Faces are found on this many pixels across. The landmarker scales its input
// down to 192 px anyway; this keeps a child's face across a room findable.
const DETECT_SIZE = 512
// Sharpness and colour need far less. Sharpness is measured on a fixed size,
// so a photo is not judged sharper for being smaller.
const MEASURE_SIZE = 256

// A face narrower than this share of the photo is someone in the background:
// they count for neither the smile nor the group.
const MIN_FACE_WIDTH = 0.06

/**
 * Brightness, colourfulness and sharpness of RGBA pixels, each 0–1.
 *
 * Colourfulness is Hasler and Süsstrunk's measure. Sharpness is the variance of
 * the Laplacian of the luminance, the usual focus measure: a blurred or shaken
 * photo has few strong edges, and its variance collapses.
 */
export function measurePixels(data, width, height) {
  const n = width * height
  if (!n) return { brightness: 0, colorfulness: 0, sharpness: 0 }
  const luma = new Float32Array(n)
  let lumaSum = 0
  let rgSum = 0, rgSq = 0, ybSum = 0, ybSq = 0
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    luma[i] = y
    lumaSum += y
    const rg = r - g
    const yb = 0.5 * (r + g) - b
    rgSum += rg
    rgSq += rg * rg
    ybSum += yb
    ybSq += yb * yb
  }
  const rgMean = rgSum / n, ybMean = ybSum / n
  const rgStd = Math.sqrt(Math.max(0, rgSq / n - rgMean * rgMean))
  const ybStd = Math.sqrt(Math.max(0, ybSq / n - ybMean * ybMean))
  const colorfulness = Math.hypot(rgStd, ybStd) + 0.3 * Math.hypot(rgMean, ybMean)

  let lapSum = 0, lapSq = 0, count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap = luma[i - 1] + luma[i + 1] + luma[i - width] + luma[i + width] - 4 * luma[i]
      lapSum += lap
      lapSq += lap * lap
      count++
    }
  }
  const lapMean = count ? lapSum / count : 0
  const variance = count ? lapSq / count - lapMean * lapMean : 0

  return {
    brightness: lumaSum / n / 255,
    // ~100 is "very colourful" on Hasler and Süsstrunk's scale.
    colorfulness: Math.min(1, colorfulness / 100),
    // A sharp photo at this size sits well above 500, a soft one well below.
    sharpness: 1 - Math.exp(-Math.max(0, variance) / 500),
  }
}

const blendshape = (shapes, name) => shapes?.categories?.find((c) => c.categoryName === name)?.score ?? 0

/**
 * The landmarker's answer, reduced to what the best-of keeps: how many faces
 * are in the photo, and the widest smile among them (0–1, the mean of the two
 * mouth-corner blendshapes).
 */
export function summariseFaces(result) {
  const landmarks = result?.faceLandmarks ?? []
  const shapes = result?.faceBlendshapes ?? []
  let faces = 0
  let smile = 0
  landmarks.forEach((points, i) => {
    if (!points?.length) return
    let minX = 1, maxX = 0
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
    }
    if (maxX - minX < MIN_FACE_WIDTH) return
    faces++
    smile = Math.max(smile, (blendshape(shapes[i], 'mouthSmileLeft') + blendshape(shapes[i], 'mouthSmileRight')) / 2)
  })
  return { faces, smile: Math.round(smile * 1000) / 1000 }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image load failed'))
    image.src = src
  })
}

function drawScaled(image, size) {
  const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Look at `photos` — collectMedia() items — one after another, and return
 * Map<url, { brightness, colorfulness, sharpness, faces?, smile? }>.
 *
 * Each photo is read from its thumbnail where it has one: 1024 px is plenty to
 * find a smile, and a tenth of the download. A photo that cannot be loaded is
 * left out and judged on what its entry says. Without the face detector — it
 * failed to load — the photos are still measured, and the awards that need
 * faces are simply not given.
 *
 * @param {Array<{ url: string, thumbUrl?: string }>} photos
 * @param {{ encryptionKey: CryptoKey|null, onProgress?: (done: number, total: number) => void,
 *           loadDetector?: () => Promise<{ detect(canvas): { faces: number, smile: number } }> }} options
 */
export async function analysePhotos(photos, { encryptionKey, onProgress, loadDetector = defaultDetector } = {}) {
  const detector = await loadDetector().catch(() => null)
  const analysis = new Map()
  let done = 0
  for (const photo of photos) {
    const source = photo.thumbUrl || photo.url
    try {
      // Without a key (the demo) the URL is the picture itself.
      const src = (await prefetchDecryptedMedia(source, encryptionKey, 'image/*')) || source
      const image = await loadImage(src)
      const measured = drawScaled(image, MEASURE_SIZE)
      const { data } = measured.getContext('2d').getImageData(0, 0, measured.width, measured.height)
      const result = measurePixels(data, measured.width, measured.height)
      if (detector) Object.assign(result, detector.detect(drawScaled(image, DETECT_SIZE)))
      analysis.set(photo.url, result)
    } catch {
      // Judged on its entry alone, like any photo that was not looked at.
    }
    onProgress?.(++done, photos.length)
    // Let the page breathe between photos: this runs while someone watches
    // a progress screen, and the screen should keep moving.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return analysis
}

function defaultDetector() {
  return import('./faceDetector').then((m) => m.createFaceDetector())
}
