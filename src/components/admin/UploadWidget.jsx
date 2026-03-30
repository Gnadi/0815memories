import { useState, useRef } from 'react'
import { X, Image as ImageIcon } from 'lucide-react'
import { CLOUDINARY_CLOUD_NAME } from '../../config/cloudinary'

export default function UploadWidget({ onUpload, currentUrl }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      // Get signed upload credentials from Vercel serverless function
      const signRes = await fetch('/api/cloudinary-sign')
      if (!signRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, folder, apiKey } = await signRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Upload failed (${response.status})`)
      }

      const data = await response.json()
      setPreview(data.secure_url)
      onUpload(data.secure_url, data.public_id)
    } catch (err) {
      console.error('Upload failed:', err)
      setPreview('')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview('')
    onUpload('', '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="relative">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden">
          <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-bark-muted rounded-xl flex flex-col items-center justify-center gap-2 hover:border-hearth hover:bg-cream-dark/50 transition-colors"
        >
          {uploading ? (
            <div className="w-8 h-8 border-3 border-hearth border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-bark-muted" />
              <span className="text-sm text-bark-muted">Click to upload a photo</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
