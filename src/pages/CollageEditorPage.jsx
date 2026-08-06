import { useState, useEffect, useCallback, useReducer, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Share2, Loader2, MoreVertical, Download, Trash2, LayoutGrid, Square } from 'lucide-react'
import { doc as firestoreDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { useCollageWriter, decryptCollage } from '../hooks/useCollages'
import { useMemoryWriter } from '../hooks/useMemories'
import { useMemoryPhotos } from '../hooks/useMemoryPhotos'
import { useScrapbookPhotoUpload } from '../hooks/useScrapbookPhotoUpload'
import CollageCanvas from '../components/collage/CollageCanvas'
import CollageSlotActionBar from '../components/collage/CollageSlotActionBar'
import TemplateStrip from '../components/collage/TemplateStrip'
import BorderPanel from '../components/collage/BorderPanel'
import PhotoBar from '../components/scrapbook/PhotoBar'
import { applyTemplate, getTemplate, makeCollageDoc } from '../components/collage/collageTemplates'
import { exportCollage } from '../utils/collageRenderer'
import { encryptAndUploadWithThumb } from '../utils/encryptedUpload'
import { devError } from '../utils/devLog'

const MAX_HISTORY = 20

function reducer(state, action) {
  const withHistory = (doc) => ({
    ...state,
    doc,
    history: [state.doc, ...state.history].slice(0, MAX_HISTORY),
    isDirty: true,
  })

  const updateSlot = (slotId, updates) => withHistory({
    ...state.doc,
    slots: state.doc.slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
  })

  switch (action.type) {
    case 'LOAD':
      return { ...state, doc: action.doc, title: action.title, isDirty: false, history: [] }

    case 'SET_TITLE':
      return { ...state, title: action.title, isDirty: true }

    case 'SET_SLOT':
      return updateSlot(action.slotId, action.updates)

    case 'FILL_SLOT':
      return updateSlot(action.slotId, {
        url: action.url,
        thumbUrl: action.thumbUrl ?? null,
        imageScale: 1,
        offsetX: 0,
        offsetY: 0,
        flipped: false,
      })

    case 'SWAP_SLOTS': {
      const a = state.doc.slots.find((s) => s.id === action.idA)
      const b = state.doc.slots.find((s) => s.id === action.idB)
      if (!a || !b) return state
      const carried = ({ url, thumbUrl, imageScale, offsetX, offsetY, flipped }) =>
        ({ url, thumbUrl, imageScale, offsetX, offsetY, flipped })
      return withHistory({
        ...state.doc,
        slots: state.doc.slots.map((s) => {
          if (s.id === action.idA) return { ...s, ...carried(b) }
          if (s.id === action.idB) return { ...s, ...carried(a) }
          return s
        }),
      })
    }

    case 'SET_TEMPLATE':
      return withHistory(applyTemplate(state.doc, getTemplate(action.templateId)))

    case 'SET_BORDER':
      return withHistory({ ...state.doc, border: { ...state.doc.border, ...action.updates } })

    case 'SET_BACKGROUND':
      return withHistory({ ...state.doc, background: action.background })

    case 'UNDO': {
      if (state.history.length === 0) return state
      const [prev, ...rest] = state.history
      return { ...state, doc: prev, history: rest, isDirty: true }
    }

    case 'MARK_SAVED':
      return { ...state, isDirty: false }

    default:
      return state
  }
}

const initialState = {
  doc: makeCollageDoc(getTemplate()),
  title: '',
  history: [],
  isDirty: false,
}

export default function CollageEditorPage() {
  const { t } = useTranslation('collage')
  const { id } = useParams()
  const navigate = useNavigate()
  const { familyId, encryptionKey } = useAuth()
  const { updateCollage, deleteCollage } = useCollageWriter(familyId, encryptionKey)
  const { addMemory } = useMemoryWriter(familyId, encryptionKey)

  const [state, dispatch] = useReducer(reducer, initialState)
  const { doc, title, isDirty } = state

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [busy, setBusy] = useState(null) // 'export' | 'share'
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('templates')
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [mode, setMode] = useState('idle') // idle | fill | replace | swap
  const [menuOpen, setMenuOpen] = useState(false)

  const { photos: memoryPhotos } = useMemoryPhotos(familyId, encryptionKey)
  const { upload, uploading, session: sessionPhotos } = useScrapbookPhotoUpload()
  const saveTimerRef = useRef(null)

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !db) { setLoading(false); return }
    let cancelled = false
    getDoc(firestoreDoc(db, 'collages', id))
      .then(async (snap) => {
        if (cancelled) return
        if (!snap.exists() || snap.data().familyId !== familyId) {
          setLoadError(t('errors.notFound'))
          setLoading(false)
          return
        }
        const data = await decryptCollage(encryptionKey, { id: snap.id, ...snap.data() })
        if (cancelled) return
        dispatch({
          type: 'LOAD',
          doc: data.doc || makeCollageDoc(getTemplate()),
          title: data.title || '',
        })
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        devError('Failed to load collage', err)
        setLoadError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, familyId, encryptionKey, t])

  // ── Debounced autosave ──────────────────────────────────────────────────
  const save = useCallback(async (nextDoc, nextTitle) => {
    if (!id) return
    setSaveStatus('saving')
    try {
      await updateCollage(id, { doc: nextDoc, title: nextTitle })
      dispatch({ type: 'MARK_SAVED' })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      devError('Collage save failed', err)
      setSaveStatus('idle')
      setError(t('errors.saveFailed'))
    }
  }, [id, updateCollage, t])

  useEffect(() => {
    if (!isDirty) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(doc, title), 2000)
    return () => clearTimeout(saveTimerRef.current)
  }, [isDirty, doc, title, save])

  useEffect(() => () => clearTimeout(saveTimerRef.current), [])

  // ── Slot interaction ────────────────────────────────────────────────────
  const selectedSlot = doc.slots.find((s) => s.id === selectedSlotId) || null
  const swapSourceId = mode === 'swap' ? selectedSlotId : null

  const handleAddPhoto = (slotId) => {
    setSelectedSlotId(slotId)
    setMode('fill')
  }

  const handleSelectSlot = (slotId) => {
    if (mode === 'swap' && selectedSlotId && slotId !== selectedSlotId) {
      dispatch({ type: 'SWAP_SLOTS', idA: selectedSlotId, idB: slotId })
      setMode('idle')
      return
    }
    setSelectedSlotId(slotId)
    setMode('idle')
  }

  const handlePickPhoto = (url) => {
    const photo = memoryPhotos.find((p) => p.url === url)
    const targetId = selectedSlotId || doc.slots.find((s) => !s.url)?.id
    if (!targetId) return
    dispatch({ type: 'FILL_SLOT', slotId: targetId, url, thumbUrl: photo?.thumbUrl || null })
    setSelectedSlotId(targetId)
    setMode('idle')
  }

  const handleUpload = async (file) => {
    const url = await upload(file)
    if (url) handlePickPhoto(url)
  }

  // ── Export / share ──────────────────────────────────────────────────────
  const filledCount = doc.slots.filter((s) => s.url).length

  const handleDownload = async () => {
    setMenuOpen(false)
    setBusy('export')
    setError(null)
    try {
      const blob = await exportCollage(doc, encryptionKey, { width: 1600 })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title || t('defaultTitle')}.jpg`
      link.click()
      // Revoked on the next tick so the click has taken the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      devError('Collage export failed', err)
      setError(t('errors.exportFailed'))
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (filledCount === 0) { setError(t('errors.needPhoto')); return }
    setBusy('share')
    setError(null)
    try {
      const blob = await exportCollage(doc, encryptionKey, { width: 1600 })
      const file = new File([blob], 'collage.jpg', { type: blob.type })
      const { url, thumbUrl } = await encryptAndUploadWithThumb(file, encryptionKey)
      await addMemory({
        title: title || t('defaultTitle'),
        content: '',
        category: 'collage',
        images: [url],
        ...(thumbUrl ? { thumbs: [thumbUrl] } : {}),
        imageUrl: url,
        date: Timestamp.now(),
        voiceMemos: [],
        videos: [],
      })
      navigate('/home')
    } catch (err) {
      devError('Collage share failed', err)
      setError(t('errors.shareFailed'))
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    if (!window.confirm(t('editor.confirmDelete'))) return
    try {
      await deleteCollage(id)
      navigate('/create')
    } catch (err) {
      devError('Collage delete failed', err)
      setError(t('errors.deleteFailed'))
    }
  }

  const stripPhotos = useMemo(() => {
    const filled = doc.slots.filter((s) => s.url).map((s) => ({ url: s.url, thumbUrl: s.thumbUrl }))
    if (filled.length > 0) return filled
    return memoryPhotos.slice(0, 6).map((p) => ({ url: p.url, thumbUrl: p.thumbUrl }))
  }, [doc, memoryPhotos])

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

  const showPhotoBar = mode === 'fill' || mode === 'replace' || (!selectedSlot && filledCount === 0)

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-bark">
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
          onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          placeholder={t('defaultTitle')}
          aria-label={t('editor.titleLabel')}
          className="flex-1 min-w-0 bg-transparent text-warm-white text-sm font-medium placeholder:text-warm-white/40 outline-none px-2"
        />

        <span className="text-[11px] text-warm-white/60 min-w-[3.5rem] text-right">
          {saveStatus === 'saving' ? t('editor.saving') : saveStatus === 'saved' ? t('editor.saved') : ''}
        </span>

        <button
          onClick={handleShare}
          disabled={busy != null}
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
            <div className="absolute right-0 top-11 z-30 w-56 rounded-xl bg-warm-white shadow-xl py-1">
              <button
                onClick={handleDownload}
                disabled={busy != null || filledCount === 0}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-bark hover:bg-cream disabled:opacity-50"
              >
                {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t('editor.download')}
              </button>
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

      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-hidden">
        <CollageCanvas
          doc={doc}
          selectedSlotId={selectedSlotId}
          onSelectSlot={handleSelectSlot}
          onAddPhoto={handleAddPhoto}
          swapSourceId={swapSourceId}
        />
      </div>

      {/* Bottom stack */}
      <div className="flex-shrink-0">
        {selectedSlot?.url && !showPhotoBar ? (
          <CollageSlotActionBar
            slot={selectedSlot}
            mode={mode}
            onDone={() => { setSelectedSlotId(null); setMode('idle') }}
            onChange={() => setMode((m) => (m === 'replace' ? 'idle' : 'replace'))}
            onSwap={() => setMode((m) => (m === 'swap' ? 'idle' : 'swap'))}
            onScale={(imageScale) => dispatch({ type: 'SET_SLOT', slotId: selectedSlotId, updates: { imageScale } })}
            onPan={(updates) => dispatch({ type: 'SET_SLOT', slotId: selectedSlotId, updates })}
            onFlip={() => dispatch({ type: 'SET_SLOT', slotId: selectedSlotId, updates: { flipped: !selectedSlot.flipped } })}
            onClear={() => {
              dispatch({ type: 'SET_SLOT', slotId: selectedSlotId, updates: { url: null, thumbUrl: null, imageScale: 1, offsetX: 0, offsetY: 0, flipped: false } })
              setMode('fill')
            }}
          />
        ) : showPhotoBar ? (
          <PhotoBar
            memoryPhotos={memoryPhotos}
            sessionPhotos={sessionPhotos}
            onUpload={handleUpload}
            onPick={handlePickPhoto}
            uploading={uploading}
            mode={mode === 'replace' ? 'replace' : 'fill'}
            hint={mode === 'replace' ? undefined : t('editor.pickHint')}
          />
        ) : null}

        {tab === 'templates' && (
          <div className="bg-warm-white border-t border-cream-dark">
            <TemplateStrip
              activeTemplateId={doc.templateId}
              photos={stripPhotos}
              onSelect={(templateId) => {
                dispatch({ type: 'SET_TEMPLATE', templateId })
                setSelectedSlotId(null)
                setMode('idle')
              }}
            />
          </div>
        )}

        {tab === 'borders' && (
          <BorderPanel
            border={doc.border}
            background={doc.background}
            onChangeBorder={(updates) => dispatch({ type: 'SET_BORDER', updates })}
            onChangeBackground={(background) => dispatch({ type: 'SET_BACKGROUND', background })}
          />
        )}

        {/* Tab row */}
        <div className="grid grid-cols-2 gap-2 px-3 py-3 bg-bark">
          {[
            { id: 'templates', icon: LayoutGrid, label: t('tabs.templates') },
            { id: 'borders', icon: Square, label: t('tabs.borders') },
          ].map((entry) => {
            const TabIcon = entry.icon
            return (
              <button
                key={entry.id}
                onClick={() => setTab((current) => (current === entry.id ? null : entry.id))}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                  tab === entry.id ? 'bg-white/15 text-warm-white' : 'text-warm-white/60 hover:bg-white/5'
                }`}
              >
                <TabIcon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{entry.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
