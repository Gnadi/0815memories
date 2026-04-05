import { createHash } from 'crypto'

export default function handler(req, res) {
  const secret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY

  if (!secret || !apiKey) {
    res.status(500).json({ error: 'Cloudinary credentials not configured' })
    return
  }

  const type = req.query?.type  // 'video_clip' for short video uploads
  const isVideoClip = type === 'video_clip'
  const isRaw = req.query?.resource_type === 'raw'
  const resourceType = isRaw ? 'raw' : (isVideoClip || req.query?.resource_type === 'video') ? 'video' : 'image'
  const folder = isRaw ? 'familyhearth/encrypted' : isVideoClip ? 'familyhearth/videos' : resourceType === 'video' ? 'familyhearth/audio' : 'familyhearth'
  const timestamp = Math.round(Date.now() / 1000)

  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex')

  res.json({ timestamp, signature, folder, apiKey, resourceType })
}
