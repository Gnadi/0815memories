import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { image } = req.body

    if (!image) {
      return res.status(400).json({ error: 'No image provided' })
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: '0815memories',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    })

    const thumbnailUrl = cloudinary.url(result.public_id, {
      width: 400,
      height: 400,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      fetch_format: 'auto'
    })

    return res.status(200).json({
      imageUrl: result.secure_url,
      thumbnailUrl,
      publicId: result.public_id
    })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
