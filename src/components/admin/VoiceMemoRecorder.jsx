import { useState, useRef } from 'react'
import { Mic, Square, Play, Pause, Trash2, Upload, Check, X } from 'lucide-react'
import { CLOUDINARY_CLOUD_NAME } from '../../config/cloudinary'

export default function VoiceMemoRecorder({ onMemoAdded }) {
  const [mode, setMode] = useState('idle') // idle | recording | recorded | uploading
  const [isPlaying, setIsPlaying] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const blobRef = useRef(null)
  const audioRef = useRef(null)
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.onloadedmetadata = () => {
            setDuration(Math.round(audioRef.current.duration))
          }
        }
        setMode('recorded')
      }

      recorder.start()
      setMode('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const discard = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    blobRef.current = null
    setMode('idle')
    setIsPlaying(false)
    setTitle('')
    setElapsed(0)
    setDuration(0)
  }

  const uploadAndSave = async () => {
    if (!blobRef.current) return
    setMode('uploading')
    setError('')
    try {
      const signRes = await fetch('/api/cloudinary-sign?resource_type=video')
      if (!signRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, folder, apiKey } = await signRes.json()

      const formData = new FormData()
      formData.append('file', blobRef.current, 'voice-memo.webm')
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: 'POST', body: formData }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Upload failed (${res.status})`)
      }
      const data = await res.json()
      onMemoAdded({ url: data.secure_url, publicId: data.public_id, title, duration })
      discard()
    } catch (err) {
      setError(err.message || 'Upload failed')
      setMode('recorded')
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError('')
    setMode('uploading')
    try {
      const signRes = await fetch('/api/cloudinary-sign?resource_type=video')
      if (!signRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, folder, apiKey } = await signRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: 'POST', body: formData }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Upload failed (${res.status})`)
      }
      const data = await res.json()
      onMemoAdded({
        url: data.secure_url,
        publicId: data.public_id,
        title: file.name.replace(/\.[^.]+$/, ''),
        duration: Math.round(data.duration || 0),
      })
      setMode('idle')
    } catch (err) {
      setError(err.message || 'Upload failed')
      setMode('idle')
    }
  }

  return (
    <div className="bg-cream-dark rounded-xl p-4 space-y-3">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />

      {/* Main controls */}
      {mode === 'idle' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 bg-hearth text-white rounded-xl text-sm font-medium hover:bg-hearth-dark transition-colors"
          >
            <Mic className="w-4 h-4" /> Record
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-bark/10 text-bark rounded-xl text-sm font-medium hover:bg-bark/20 transition-colors"
          >
            <Upload className="w-4 h-4" /> Upload audio
          </button>
        </div>
      )}

      {mode === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-hearth font-medium">
            <span className="w-2 h-2 rounded-full bg-hearth animate-pulse" />
            Recording {formatTime(elapsed)}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bark text-white rounded-xl text-sm hover:bg-bark-light transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Stop
          </button>
        </div>
      )}

      {mode === 'recorded' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-hearth flex items-center justify-center text-white hover:bg-hearth-dark transition-colors flex-shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <span className="text-xs text-bark-muted">{formatTime(duration)}</span>
            <button
              type="button"
              onClick={discard}
              className="ml-auto text-bark-muted hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Label this voice memo (optional)"
            className="w-full px-3 py-2 bg-warm-white rounded-xl text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
          />
          <button
            type="button"
            onClick={uploadAndSave}
            className="flex items-center gap-2 px-4 py-2 bg-hearth text-white rounded-xl text-sm font-medium hover:bg-hearth-dark transition-colors"
          >
            <Check className="w-4 h-4" /> Add to memory
          </button>
        </div>
      )}

      {mode === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-bark-muted">
          <div className="w-4 h-4 border-2 border-hearth border-t-transparent rounded-full animate-spin" />
          Uploading voice memo…
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <X className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  )
}
