import React, { useRef, useState } from 'react'
import { uploadToCloudinary } from '../utils/cloudinary'
import { useAuth } from '../contexts/AuthContext'

/**
 * Drag-and-drop + click image uploader.
 * Calls onUpload({ publicId, url }) for each uploaded file.
 */
export default function ImageUpload({ onUpload, multiple = true, className = '' }) {
  const { getAdminToken } = useAuth()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState([]) // [{ name, progress, done, error, url }]

  async function handleFiles(files) {
    const fileArray = Array.from(files)
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue

      const entry = { name: file.name, progress: 0, done: false, error: null, url: null }
      setUploads(prev => [...prev, entry])
      const idx = uploads.length

      try {
        const token = await getAdminToken()
        const result = await uploadToCloudinary(file, token, (pct) => {
          setUploads(prev =>
            prev.map((u, i) => (u.name === file.name ? { ...u, progress: pct } : u))
          )
        })
        setUploads(prev =>
          prev.map(u => (u.name === file.name ? { ...u, done: true, url: result.url } : u))
        )
        onUpload(result)
      } catch (err) {
        setUploads(prev =>
          prev.map(u => (u.name === file.name ? { ...u, error: err.message } : u))
        )
      }
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className={className}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors duration-150 ${
          dragging
            ? 'border-terra bg-terra/5'
            : 'border-hearth-border bg-hearth-bg hover:border-terra/50'
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-10 h-10 text-hearth-muted mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm font-medium text-hearth-text">Drop photos here or click to browse</p>
        <p className="text-xs text-hearth-muted mt-1">JPEG, PNG, WEBP — up to 10MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u, i) => (
            <li key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-card">
              {u.url ? (
                <img src={u.url} alt={u.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-hearth-border flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-hearth-muted" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-hearth-text truncate">{u.name}</p>
                {!u.done && !u.error && (
                  <div className="mt-1 h-1.5 bg-hearth-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-terra rounded-full transition-all duration-200"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
                {u.done && <p className="text-xs text-green-600 mt-0.5">Uploaded</p>}
                {u.error && <p className="text-xs text-red-500 mt-0.5">{u.error}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
