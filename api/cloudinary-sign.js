import { createHash } from 'crypto'

export default function handler(_req, res) {
  const secret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY

  if (!secret || !apiKey) {
    res.status(500).json({ error: 'Cloudinary credentials not configured' })
    return
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'familyhearth'

  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex')

  res.json({ timestamp, signature, folder, apiKey })
}
