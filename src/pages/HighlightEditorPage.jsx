import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Loader2, Download, Trash2, Share2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import { doc as firestoreDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { useHighlightWriter, decryptHighlight } from '../hooks/useHighlights'
import { useMemoryWriter } from '../hooks/useMemories'
import { useMemoryPhotos } from '../hooks/useMemoryPhotos'
import { useScrapbookPhotoUpload } from '../hooks/useScrapbookPhotoUpload'
import ReelPlayer from '../components/highlight/ReelPlayer'
import PhotoBar from '../components/scrapbook/PhotoBar'
import EncryptedImage from '../components/media/EncryptedImage'
import {
  buildTimeline,
  canRecordReel,
  loadReelImages,
  makeHighlightDoc,
  recordReel,
  recordedFileExtension,
  REEL_THEMES,
  DEFAULT_SHOT_MS,
  MIN_SHOT_MS,
  MAX_SHOT_MS,
} from '../utils/reelRenderer'
import { encryptAndUpload } from '../utils/encryptedUpload'
import { MAX_PLAINTEXT_BYTES, formatBytes } from '../constants/media'
import { devError } from '../utils/devLog'

const ASPECT_OPTIONS = ['9:16', '1:1', '4:5']

export default function HighlightEditorPage() {
  const { t } = useTranslation('collage')
  const { id } = useParams()
  const navigate = useNavigate()
  const { familyId, encryptionKey } = useAuth()
  const { updateHighlight, deleteHighlight } = useHighlightWriter(familyId, encryptionKey)
  const { addMemory } = useMemoryWriter(familyId, encryptionKey)

  const [doc, setDoc] = useState(() => makeHighlightDoc())
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [images, setImages] = useState(() => new Map())
  const [busy, setBusy] = useState(null) // 'render' | 'share'
  const [renderProgress, setRenderProgress] = useState(0)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedShot, setSelectedShot] = useState(0)

  const { photos: memoryPhotos } = useMemoryPhotos(familyId, encryptionKey)
  const { upload, uploading, session: sessionPhotos } = useScrapbookPhotoUpload()
  const canvasRef = useRef(null)
  const saveTimerRef = useRef(null)

  const recordingSupported = useMemo(() => canRecordReel(), [])
  const timeline = useMemo(
    () => buildTimeline(doc.shots, { transitionMs: doc.transitionMs, titleCard: doc.titleCard }),
    [doc]
  )

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !db) { setLoading(false); return }
    let cancelled = false
    getDoc(firestoreDoc(db, 'highlights', id))
      .then(async (snap) => {
        if (cancelled) return
        if (!snap.exists() || snap.data().familyId !== familyId) {
          setLoadError(t('errors.notFound'))
          setLoading(false)
          return
        }
        const data = await decryptHighlight(encryptionKey, { id: snap.id, ...snap.data() })
        if (cancelled) return
        setDoc(data.doc || makeHighlightDoc())
        setTitle(data.title || '')
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        devError('Failed to load highlight', err)
        setLoadError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, familyId, encryptionKey, t])

  // ── Decrypt the shots ───────────────────────────────────────────────────
  const shotKey = doc.shots.map((s) => s.url).join('|')
  useEffect(() => {
    let cancelled = false
    if (!shotKey) { setImages(new Map()); return }
    loadReelImages(shotKey.split('|').map((url) => ({ url })), encryptionKey).then((map) => {
      if (!cancelled) setImages(map)
    })
    return () => { cancelled = true }
  }, [shotKey, encryptionKey])

  // ── Debounced autosave ──────────────────────────────────────────────────
  const save = useCallback(async (nextDoc, nextTitle) => {
    if (!id) return
    setSaveStatus('saving')
    try {
      await updateHighlight(id, { doc: nextDoc, title: nextTitle })
      setIsDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      devError('Highlight save failed', err)
      setSaveStatus('idle')
      setError(t('errors.saveFailed'))
    }
  }, [id, updateHighlight, t])

  useEffect(() => {
    if (!isDirty) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(doc, title), 2000)
    return () => clearTimeout(saveTimerRef.current)
  }, [isDirty, doc, title, save])

  useEffect(() => () => clearTimeout(saveTimerRef.current), [])

  const patchDoc = (updates) => {
    setDoc((prev) => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  const patchShot = (index, updates) => {
    setDoc((prev) => ({
      ...prev,
      shots: prev.shots.map((shot, i) => (i === index ? { ...shot, ...updates } : shot)),
    }))
    setIsDirty(true)
  }

  const addShot = (url) => {
    const photo = memoryPhotos.find((p) => p.url === url)
    setDoc((prev) => ({
      ...prev,
      shots: [...prev.shots, { url, thumbUrl: photo?.thumbUrl || null, memoryId: photo?.memoryId || null, durationMs: DEFAULT_SHOT_MS }],
    }))
    setIsDirty(true)
  }

  const removeShot = (index) => {
    setDoc((prev) => ({ ...prev, shots: prev.shots.filter((_, i) => i !== index) }))
    setSelectedShot((current) => Math.max(0, current > index ? current - 1 : current))
    setIsDirty(true)
  }

  const moveShot = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= doc.shots.length) return
    setDoc((prev) => {
      const shots = [...prev.shots]
      const [moved] = shots.splice(index, 1)
      shots.splice(target, 0, moved)
      return { ...prev, shots }
    })
    setSelectedShot(target)
    setIsDirty(true)
  }

  const handleUpload = async (file) => {
    const url = await upload(file)
    if (url) addShot(url)
  }

  // ── Render the video ────────────────────────────────────────────────────
  const renderVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas) throw new Error('No canvas')
    setRenderProgress(0)
    const { blob, mimeType } = await recordReel(canvas, doc, images, timeline, {
      onProgress: (ms) => setRenderProgress(timeline.durationMs ? ms / timeline.durationMs : 0),
    })
    return { blob, mimeType }
  }

  const handleDownload = async () => {
    setMenuOpen(false)
    if (doc.shots.length === 0) { setError(t('errors.needShots')); return }
    setBusy('render')
    setError(null)
    try {
      const { blob, mimeType } = await renderVideo()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title || t('reel.defaultTitle')}.${recordedFileExtension(mimeType)}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      devError('Reel render failed', err)
      setError(t('errors.renderFailed'))
    } finally {
      setBusy(null)
      setRenderProgress(0)
    }
  }

  const handleShare = async () => {
    if (doc.shots.length === 0) { setError(t('errors.needShots')); return }
    setBusy('share')
    setError(null)
    try {
      const { blob, mimeType } = await renderVideo()
      // Encrypted media goes to Cloudinary as a raw asset, which is capped well
      // below the video limit. Say so with real numbers instead of letting the
      // upload fail after another full render.
      if (blob.size > MAX_PLAINTEXT_BYTES) {
        setError(t('errors.videoTooLarge', {
          size: formatBytes(blob.size),
          limit: formatBytes(MAX_PLAINTEXT_BYTES),
        }))
        return
      }
      const file = new File([blob], `highlight.${recordedFileExtension(mimeType)}`, { type: mimeType })
      const { url, publicId } = await encryptAndUpload(file, encryptionKey)
      await addMemory({
        title: title || t('reel.defaultTitle'),
        content: '',
        category: 'highlight',
        images: [],
        imageUrl: '',
        date: Timestamp.now(),
        voiceMemos: [],
        videos: [{ url, publicId, title: title || t('reel.defaultTitle') }],
      })
      navigate('/home')
    } catch (err) {
      devError('Reel share failed', err)
      setError(t('errors.shareFailed'))
    } finally {
      setBusy(null)
      setRenderProgress(0)
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    if (!window.confirm(t('reel.confirmDelete'))) return
    try {
      await deleteHighlight(id)
      navigate('/create')
    } catch (err) {
      devError('Highlight delete failed', err)
      setError(t('errors.deleteFailed'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-kaydo" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-bark flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-warm-white font-semibold">{loadError}</p>
        <button onClick={() => navigate('/create')} className="btn-kaydo">{t('editor.backToCreate')}</button>
      </div>
    )
  }

  const shot = doc.shots[selectedShot]

  return (
    <div className="min-h-dvh flex flex-col bg-bark">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => navigate('/create')}
          aria-label={t('editor.close')}
          className="w-10 h-10 rounded-full bg-white/10 text-warm-white flex items-center justify-center hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>

        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setIsDirty(true) }}
          placeholder={t('reel.defaultTitle')}
          aria-label={t('editor.titleLabel')}
          className="flex-1 min-w-0 bg-transparent text-warm-white text-sm font-medium placeholder:text-warm-white/40 outline-none px-2"
        />

        <span className="text-[11px] text-warm-white/60 min-w-[3.5rem] text-right">
          {saveStatus === 'saving' ? t('editor.saving') : saveStatus === 'saved' ? t('editor.saved') : ''}
        </span>

        <button
          onClick={handleShare}
          disabled={busy != null || !recordingSupported}
          aria-label={t('editor.share')}
          className="w-10 h-10 rounded-full bg-white/10 text-warm-white flex items-center justify-center hover:bg-white/20 disabled:opacity-50"
        >
          {busy === 'share' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
        </button>

        <button
          onClick={() => save(doc, title)}
          disabled={busy != null}
          className="px-4 h-10 rounded-full bg-white/10 text-warm-white text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
        >
          {t('editor.save')}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t('editor.more')}
            className="w-10 h-10 rounded-full text-warm-white flex items-center justify-center hover:bg-white/10"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-30 w-60 rounded-xl bg-warm-white shadow-xl py-1">
              {recordingSupported && (
                <button
                  onClick={handleDownload}
                  disabled={busy != null || doc.shots.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-bark hover:bg-cream disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {t('reel.download')}
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                {t('editor.delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-red-500/15 text-red-200 text-xs">{error}</div>
      )}

      {busy && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-white/10 text-warm-white text-xs flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('reel.rendering', { percent: Math.round(renderProgress * 100) })}
        </div>
      )}

      {/* Player */}
      <div className="px-4 py-3">
        <ReelPlayer ref={canvasRef} doc={doc} images={images} disabled={busy != null} />
      </div>

      {!recordingSupported && (
        <p className="px-6 pb-3 text-[11px] text-warm-white/60 text-center">{t('reel.noRecording')}</p>
      )}

      {/* Title card */}
      <div className="px-4 pb-3 space-y-2">
        <input
          value={doc.titleCard?.text || ''}
          onChange={(e) => patchDoc({ titleCard: { ...doc.titleCard, text: e.target.value } })}
          placeholder={t('reel.titleCardText')}
          className="w-full rounded-xl bg-white/10 text-warm-white text-sm px-3 py-2 placeholder:text-warm-white/40 outline-none"
        />
        <input
          value={doc.titleCard?.subtitle || ''}
          onChange={(e) => patchDoc({ titleCard: { ...doc.titleCard, subtitle: e.target.value } })}
          placeholder={t('reel.titleCardSubtitle')}
          className="w-full rounded-xl bg-white/10 text-warm-white text-sm px-3 py-2 placeholder:text-warm-white/40 outline-none"
        />
      </div>

      {/* Style row */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
        {ASPECT_OPTIONS.map((aspect) => (
          <button
            key={aspect}
            onClick={() => patchDoc({ aspect })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              doc.aspect === aspect ? 'bg-kaydo text-white' : 'bg-white/10 text-warm-white/80'
            }`}
          >
            {aspect}
          </button>
        ))}
        <span className="w-px h-5 bg-white/15 mx-1" />
        {REEL_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => patchDoc({ theme: theme.id })}
            aria-label={t(`reel.themes.${theme.id}`)}
            className={`w-7 h-7 rounded-full border-2 ${doc.theme === theme.id ? 'border-kaydo scale-110' : 'border-white/20'}`}
            style={{ backgroundColor: theme.background }}
          />
        ))}
      </div>

      {/* Shot list */}
      <div className="px-4 pb-2">
        <h3 className="text-xs font-semibold text-warm-white/70 mb-2">
          {t('reel.shots', { count: doc.shots.length })}
        </h3>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {doc.shots.map((s, index) => (
            <button
              key={`${s.url}-${index}`}
              onClick={() => setSelectedShot(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 ${
                index === selectedShot ? 'border-kaydo' : 'border-white/15'
              }`}
            >
              <EncryptedImage src={s.url} thumbSrc={s.thumbUrl || ''} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {doc.shots.length === 0 && (
            <p className="text-xs text-warm-white/50 italic py-4">{t('reel.emptyShots')}</p>
          )}
        </div>
      </div>

      {/* Selected shot controls */}
      {shot && (
        <div className="px-4 pb-3 flex items-center gap-3">
          <button
            onClick={() => moveShot(selectedShot, -1)}
            aria-label={t('reel.moveEarlier')}
            className="w-8 h-8 rounded-full bg-white/10 text-warm-white flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => moveShot(selectedShot, 1)}
            aria-label={t('reel.moveLater')}
            className="w-8 h-8 rounded-full bg-white/10 text-warm-white flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <label className="flex-1 flex items-center gap-2">
            <span className="text-[11px] text-warm-white/70 whitespace-nowrap">{t('reel.duration')}</span>
            <input
              type="range"
              min={MIN_SHOT_MS}
              max={MAX_SHOT_MS}
              step={100}
              value={shot.durationMs || DEFAULT_SHOT_MS}
              onChange={(e) => patchShot(selectedShot, { durationMs: parseInt(e.target.value, 10) })}
              className="flex-1 accent-kaydo"
            />
            <span className="text-[11px] tabular-nums text-warm-white/70 w-10 text-right">
              {((shot.durationMs || DEFAULT_SHOT_MS) / 1000).toFixed(1)}s
            </span>
          </label>
          <button
            onClick={() => removeShot(selectedShot)}
            aria-label={t('reel.removeShot')}
            className="w-8 h-8 rounded-full text-red-300 hover:bg-red-500/15 flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Photo picker */}
      <div className="mt-auto">
        <PhotoBar
          memoryPhotos={memoryPhotos}
          sessionPhotos={sessionPhotos}
          onUpload={handleUpload}
          onPick={addShot}
          uploading={uploading}
          mode="idle"
          hint={t('reel.pickHint')}
        />
      </div>
    </div>
  )
}
