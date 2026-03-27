const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

/**
 * Build a Cloudinary delivery URL with transformations.
 * @param {string} publicIdOrUrl - Cloudinary public ID or full URL
 * @param {object} opts
 */
export function cloudinaryUrl(publicIdOrUrl, opts = {}) {
  if (!publicIdOrUrl) return ''

  // If it's already a full https URL, return as-is or rebuild with transforms
  if (publicIdOrUrl.startsWith('http')) {
    if (!opts.transform) return publicIdOrUrl
    // Insert transformation into existing Cloudinary URL
    return publicIdOrUrl.replace('/upload/', `/upload/${opts.transform}/`)
  }

  const {
    width,
    height,
    quality = 'auto:eco',
    format = 'auto',
    crop = 'fill',
    transform,
  } = opts

  const parts = []
  if (width) parts.push(`w_${width}`)
  if (height) parts.push(`h_${height}`)
  if (crop) parts.push(`c_${crop}`)
  parts.push(`q_${quality}`)
  parts.push(`f_${format}`)
  if (transform) parts.push(transform)

  const transformStr = parts.join(',')

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformStr}/${publicIdOrUrl}`
}

/**
 * Upload a file to Cloudinary using pre-signed params from /api/upload.
 * @param {File} file
 * @param {string} adminToken - Firebase ID token
 * @param {function} onProgress - called with 0-100
 * @returns {Promise<{publicId: string, url: string}>}
 */
export async function uploadToCloudinary(file, adminToken, onProgress) {
  // 1. Get signed upload params from our server
  const sigRes = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ folder: 'memories' }),
  })

  if (!sigRes.ok) throw new Error('Failed to get upload signature')
  const { signature, timestamp, apiKey, cloudName, folder } = await sigRes.json()

  // 2. Upload directly to Cloudinary
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp)
  formData.append('signature', signature)
  formData.append('folder', folder)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({ publicId: data.public_id, url: data.secure_url })
      } else {
        reject(new Error('Upload failed: ' + xhr.responseText))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(formData)
  })
}
