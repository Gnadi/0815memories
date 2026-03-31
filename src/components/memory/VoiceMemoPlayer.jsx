import { useState, useRef, useEffect } from 'react'
import { Mic, Play, Pause } from 'lucide-react'

function SingleMemoPlayer({ memo }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(memo.duration || 0)
  const audioRef = useRef(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onMeta = () => setDuration(Math.round(el.duration) || memo.duration || 0)
    const onTime = () => {
      setCurrentTime(Math.round(el.currentTime))
      setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0)
    }
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0) }
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnded)
    }
  }, [memo.duration])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      el.play()
      setIsPlaying(true)
    }
  }

  const handleSeek = (e) => {
    const el = audioRef.current
    if (!el || !el.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    el.currentTime = ratio * el.duration
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div className="flex items-center gap-3 bg-cream-dark rounded-xl px-4 py-3">
      <audio ref={audioRef} src={memo.url} preload="metadata" />

      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-hearth flex items-center justify-center text-white hover:bg-hearth-dark transition-colors flex-shrink-0"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        {memo.title && (
          <p className="text-xs font-medium text-bark mb-1 truncate">{memo.title}</p>
        )}
        {/* Progress bar */}
        <div
          className="h-1.5 bg-bark/15 rounded-full cursor-pointer relative"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-hearth rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="text-xs text-bark-muted tabular-nums flex-shrink-0">
        {formatTime(isPlaying ? currentTime : duration)}
      </span>
    </div>
  )
}

export default function VoiceMemoPlayer({ voiceMemos }) {
  if (!voiceMemos?.length) return null

  return (
    <div className="mt-8">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-bark mb-3">
        <Mic className="w-4 h-4 text-hearth" />
        Voice Memos
        <span className="text-bark-muted font-normal">({voiceMemos.length})</span>
      </h3>
      <div className="space-y-2">
        {voiceMemos.map((memo, i) => (
          <SingleMemoPlayer key={memo.publicId || i} memo={memo} />
        ))}
      </div>
    </div>
  )
}
