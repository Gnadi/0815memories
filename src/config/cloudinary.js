export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export function getCloudinaryUrl(publicId, transforms = '') {
  if (!publicId) return ''
  if (publicId.startsWith('http')) return publicId
  const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`
  return transforms ? `${base}/${transforms}/${publicId}` : `${base}/${publicId}`
}

export function getThumbnailUrl(publicId) {
  return getCloudinaryUrl(publicId, 'w_400,h_300,c_fill,q_auto')
}

export function getHeroUrl(publicId) {
  return getCloudinaryUrl(publicId, 'w_1200,h_600,c_fill,q_auto')
}
