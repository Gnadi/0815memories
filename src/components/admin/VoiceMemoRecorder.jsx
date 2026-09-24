import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Square, Play, Pause, Trash2, Upload, Check, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { encryptAndUpload } from '../../utils/encryptedUpload'

export default function VoiceMemoRecorder({ onMemoAdded }) {
  const { t } = useTranslation('memory')
  const { encryptionKey } = useAuth()
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
  const streamRef = useRef(null)
  const previewUrlRef = useRef(null)

  const releasePreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }

  // Closing the dialog mid-recording used to leave the microphone on — the
  // browser's recording indicator stayed lit until the page was reloaded.
  useEffect(() => () => {
    clearInterval(timerRef.current)
    const recorder = mediaRecorderRef.current
    if (recorder) recorder.onstop = null
    if (recorder?.state === 'recording') recorder.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    releasePreview()
  }, [])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        // Whatever the browser actually recorded: Chrome and Firefox produce
        // WebM, Safari MP4. Labelling Safari's recording audio/webm left the
        // preview below unplayable there.
        const type = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        blobRef.current = blob
        releasePreview()
        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
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
      setError(t('recorder.micDenied'))
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
    releasePreview()
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
      const { url, publicId } = await encryptAndUpload(blobRef.current, encryptionKey)
      onMemoAdded({ url, publicId, title, duration })
      discard()
    } catch {
      setError(t('recorder.uploadFailed'))
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
      const { url, publicId } = await encryptAndUpload(file, encryptionKey)
      onMemoAdded({
        url,
        publicId,
        title: file.name.replace(/\.[^.]+$/, ''),
        duration: 0,
      })
      setMode('idle')
    } catch {
      setError(t('recorder.uploadFailed'))
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
            className="flex items-center gap-2 px-4 py-2 bg-kaydo text-white rounded-xl text-sm font-medium hover:bg-kaydo-dark transition-colors"
          >
            <Mic className="w-4 h-4" /> {t('recorder.record')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-bark/10 text-bark rounded-xl text-sm font-medium hover:bg-bark/20 transition-colors"
          >
            <Upload className="w-4 h-4" /> {t('recorder.uploadAudio')}
          </button>
        </div>
      )}

      {mode === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-kaydo font-medium">
            <span className="w-2 h-2 rounded-full bg-kaydo animate-pulse" />
            {t('recorder.recording', { time: formatTime(elapsed) })}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bark text-white rounded-xl text-sm hover:bg-bark-light transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> {t('recorder.stop')}
          </button>
        </div>
      )}

      {mode === 'recorded' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-kaydo flex items-center justify-center text-white hover:bg-kaydo-dark transition-colors flex-shrink-0"
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
            placeholder={t('recorder.titlePlaceholder')}
            className="w-full px-3 py-2 bg-warm-white rounded-xl text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          />
          <button
            type="button"
            onClick={uploadAndSave}
            className="flex items-center gap-2 px-4 py-2 bg-kaydo text-white rounded-xl text-sm font-medium hover:bg-kaydo-dark transition-colors"
          >
            <Check className="w-4 h-4" /> {t('recorder.addToMemory')}
          </button>
        </div>
      )}

      {mode === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-bark-muted">
          <div className="w-4 h-4 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
          {t('recorder.uploading')}
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
