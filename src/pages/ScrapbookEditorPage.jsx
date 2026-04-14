import { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { useScrapbooks } from '../hooks/useScrapbooks'
import { useMemoryPhotos } from '../hooks/useMemoryPhotos'
import { useScrapbookPhotoUpload } from '../hooks/useScrapbookPhotoUpload'
import ScrapbookCanvas from '../components/scrapbook/ScrapbookCanvas'
import EditorToolbar from '../components/scrapbook/EditorToolbar'
import PhotoBar from '../components/scrapbook/PhotoBar'
import PhotoActionBar from '../components/scrapbook/PhotoActionBar'
import BottomToolRow from '../components/scrapbook/BottomToolRow'
import PageNavBar from '../components/scrapbook/PageNavBar'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ─── Editor state reducer ─────────────────────────────────────────────────────

const MAX_HISTORY = 20

function makeBlankPage() {
  return {
    id: crypto.randomUUID(),
    backgroundColor: '#FDF6EC',
    backgroundPattern: 'none',
    elements: [],
    customizable: false,
  }
}

function editorReducer(state, action) {
  const { pages, currentPageIndex } = state

  const withHistory = (newPages) => {
    const history = [pages, ...state.history].slice(0, MAX_HISTORY)
    return { ...state, pages: newPages, history, isDirty: true }
  }

  const updateCurrentPage = (updater) => {
    const newPages = pages.map((p, i) => i === currentPageIndex ? updater(p) : p)
    return withHistory(newPages)
  }

  switch (action.type) {
    case 'LOAD':
      return { ...state, pages: action.pages, title: action.title ?? state.title, isDirty: false, history: [] }

    case 'SET_TITLE':
      return { ...state, title: action.title, isDirty: true }

    case 'SWITCH_PAGE':
      return { ...state, currentPageIndex: action.index, selectedId: null }

    case 'ADD_PAGE':
      return { ...withHistory([...pages, makeBlankPage()]), currentPageIndex: pages.length, selectedId: null }

    case 'DELETE_PAGE': {
      if (pages.length <= 1) return state
      const newPages = pages.filter((_, i) => i !== action.index)
      const newIndex = Math.min(currentPageIndex, newPages.length - 1)
      return { ...withHistory(newPages), currentPageIndex: newIndex, selectedId: null }
    }

    case 'ADD_ELEMENT':
      return updateCurrentPage((p) => ({
        ...p,
        elements: [...p.elements, { id: crypto.randomUUID(), ...action.element }],
      }))

    case 'UPDATE_ELEMENT':
      return updateCurrentPage((p) => ({
        ...p,
        elements: p.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.updates } : el
        ),
      }))

    case 'DELETE_ELEMENT':
      return updateCurrentPage((p) => ({
        ...p,
        elements: p.elements.filter((el) => el.id !== action.id),
      }))

    case 'SWAP_PHOTOS': {
      const { idA, idB } = action
      return updateCurrentPage((p) => {
        const a = p.elements.find((e) => e.id === idA)
        const b = p.elements.find((e) => e.id === idB)
        if (!a || !b) return p
        return {
          ...p,
          elements: p.elements.map((el) => {
            if (el.id === idA) return { ...el, url: b.url, isSlot: !b.url, imageScale: b.imageScale || 1, flipped: !!b.flipped }
            if (el.id === idB) return { ...el, url: a.url, isSlot: !a.url, imageScale: a.imageScale || 1, flipped: !!a.flipped }
            return el
          }),
        }
      })
    }

    case 'APPLY_LAYOUT':
      return updateCurrentPage((p) => ({ ...p, elements: action.elements }))

    case 'CHANGE_BACKGROUND':
      return updateCurrentPage((p) => ({ ...p, ...action.updates }))

    case 'TOGGLE_CUSTOMIZE':
      return updateCurrentPage((p) => ({ ...p, customizable: !p.customizable }))

    case 'SELECT':
      return { ...state, selectedId: action.id }

    case 'UNDO': {
      if (state.history.length === 0) return state
      const [prev, ...rest] = state.history
      return { ...state, pages: prev, history: rest, isDirty: true }
    }

    case 'MARK_SAVED':
      return { ...state, isDirty: false }

    default:
      return state
  }
}

const initialState = {
  pages: [makeBlankPage()],
  currentPageIndex: 0,
  selectedId: null,
  history: [],
  isDirty: false,
  title: 'My Scrapbook',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScrapbookEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { familyId, encryptionKey } = useAuth()
  const { updateScrapbook } = useScrapbooks(familyId, encryptionKey)

  const [state, dispatch] = useReducer(editorReducer, initialState)
  const { pages, currentPageIndex, selectedId, isDirty, title, history } = state

  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [exporting, setExporting] = useState(false)
  // Photo bar interaction mode: 'idle' | 'fill' | 'replace' | 'swap'
  const [photoMode, setPhotoMode] = useState('idle')

  // Family memory photos + session uploads
  const { photos: memoryPhotos } = useMemoryPhotos(familyId, encryptionKey)
  const { upload, uploading, session: sessionPhotos } = useScrapbookPhotoUpload()

  const canvasRef = useRef(null)
  const saveTimerRef = useRef(null)

  // Load scrapbook once on mount
  useEffect(() => {
    if (!id || !db) { setLoading(false); return }
    getDoc(doc(db, 'scrapbooks', id)).then(async (snap) => {
      if (!snap.exists()) { setLoadError('Scrapbook not found'); setLoading(false); return }
      const raw = snap.data()
      if (raw.familyId !== familyId) { setLoadError('Scrapbook not found'); setLoading(false); return }
      let nextTitle = raw.title || 'My Scrapbook'
      let nextPages = raw.pages || [makeBlankPage()]
      if (encryptionKey) {
        const { decryptText, decryptJSON } = await import('../utils/encryption')
        if (typeof nextTitle === 'string') nextTitle = await decryptText(encryptionKey, nextTitle)
        if (typeof nextPages === 'string') nextPages = await decryptJSON(encryptionKey, nextPages)
      }
      // Migration: pages without an explicit `customizable` flag predate the
      // photobook redesign and should default to customizable so existing
      // freely-placed photos remain draggable/resizable.
      nextPages = nextPages.map((p) => (
        Object.prototype.hasOwnProperty.call(p, 'customizable')
          ? p
          : { ...p, customizable: true }
      ))
      dispatch({ type: 'LOAD', pages: nextPages, title: nextTitle })
      setLoading(false)
    }).catch((err) => {
      setLoadError(err.message)
      setLoading(false)
    })
  }, [id, familyId, encryptionKey])

  // Debounced auto-save
  const save = useCallback(async (pagesData, currentTitle) => {
    if (!id) return
    setSaveStatus('saving')
    try {
      let coverImageUrl = null
      for (const page of pagesData) {
        const photo = page.elements.find((el) => el.type === 'photo' && el.url)
        if (photo) { coverImageUrl = photo.url; break }
      }
      await updateScrapbook(id, { pages: pagesData, title: currentTitle, coverImageUrl })
      dispatch({ type: 'MARK_SAVED' })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [id, updateScrapbook])

  useEffect(() => {
    if (!isDirty) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(pages, title), 2000)
    return () => clearTimeout(saveTimerRef.current)
  }, [isDirty, pages, title, save])

  useEffect(() => () => clearTimeout(saveTimerRef.current), [])

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!canvasRef.current) return
    const originalPageIndex = currentPageIndex
    const totalPages = pages.length
    setExporting(true)
    try {
      await document.fonts.ready
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] })

      for (let i = 0; i < totalPages; i++) {
        // Force the page switch to commit synchronously so html2canvas reads
        // the freshly-rendered DOM instead of whatever was mounted before.
        flushSync(() => {
          dispatch({ type: 'SWITCH_PAGE', index: i })
        })
        // Give the browser a paint cycle + a chance to decode any newly
        // mounted images before capturing.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

        // The canvas element has a viewport-fit transform (e.g. scale(0.4) on
        // mobile). html2canvas uses getBoundingClientRect() to size its output,
        // which returns the *visual* size, so the capture would be undersized
        // and then stretched to fill the PDF page. Reset the transform to none
        // for the duration of the capture so html2canvas always sees 800×600.
        const el = canvasRef.current
        const savedTransform = el.style.transform
        const savedTransformOrigin = el.style.transformOrigin
        el.style.transform = 'none'
        el.style.transformOrigin = 'top left'

        const canvas = await html2canvas(el, {
          useCORS: true,
          scale: 2,
          width: 800,
          height: 600,
          backgroundColor: null,
          logging: false,
        })

        el.style.transform = savedTransform
        el.style.transformOrigin = savedTransformOrigin
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage([800, 600], 'landscape')
        pdf.addImage(imgData, 'JPEG', 0, 0, 800, 600)
      }

      // Restore the page the user was viewing before export.
      flushSync(() => {
        dispatch({ type: 'SWITCH_PAGE', index: originalPageIndex })
      })

      pdf.save(`${title}.pdf`)
    } catch (err) {
      console.error('PDF export failed', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const currentPage = pages[currentPageIndex] || pages[0]
  const selectedElement = currentPage?.elements.find((el) => el.id === selectedId) || null
  const isPhotoSelected = selectedElement?.type === 'photo' && !!selectedElement?.url
  const isSlotSelected = selectedElement?.type === 'photo' && !selectedElement?.url
  const editable = !!currentPage?.customizable

  const handleAddElement = (element) => dispatch({ type: 'ADD_ELEMENT', element })
  const handleUpdateElement = (elementId, updates) => dispatch({ type: 'UPDATE_ELEMENT', id: elementId, updates })
  const handleDeleteElement = (elementId) => {
    dispatch({ type: 'DELETE_ELEMENT', id: elementId })
    setPhotoMode('idle')
  }
  const handleApplyLayout = (elements) => dispatch({ type: 'APPLY_LAYOUT', elements })
  const handleChangeBackground = (updates) => dispatch({ type: 'CHANGE_BACKGROUND', updates })

  const handleSelectElement = (elementId) => {
    dispatch({ type: 'SELECT', id: elementId })
    // Auto switch mode: if the new selection is an empty slot, enter fill mode
    if (!elementId) {
      setPhotoMode('idle')
      return
    }
    const el = currentPage.elements.find((e) => e.id === elementId)
    if (el?.type === 'photo' && !el.url) setPhotoMode('fill')
    else setPhotoMode('idle')
  }

  const handleUndo = () => dispatch({ type: 'UNDO' })
  const handleAddPage = () => dispatch({ type: 'ADD_PAGE' })
  const handleDeletePage = (pageIndex) => dispatch({ type: 'DELETE_PAGE', index: pageIndex })
  const handleSwitchPage = (pageIndex) => dispatch({ type: 'SWITCH_PAGE', index: pageIndex })
  const handleTitleChange = (newTitle) => dispatch({ type: 'SET_TITLE', title: newTitle })
  const handleToggleCustomize = () => dispatch({ type: 'TOGGLE_CUSTOMIZE' })

  // ── Photo picker behaviour ──────────────────────────────────────────────────
  const handlePickPhoto = (url) => {
    if (isSlotSelected && (photoMode === 'fill' || photoMode === 'idle')) {
      handleUpdateElement(selectedId, { url, isSlot: false })
      setPhotoMode('idle')
      return
    }
    if (isPhotoSelected && photoMode === 'replace') {
      handleUpdateElement(selectedId, { url })
      setPhotoMode('idle')
      return
    }
    // No matching selection — add as a new floating photo element
    handleAddElement({
      type: 'photo',
      url,
      x: 60,
      y: 60,
      width: 300,
      height: 240,
      rotation: 0,
      polaroid: false,
      caption: '',
      imageScale: 1,
      flipped: false,
      zIndex: Date.now(),
    })
  }

  const handleUpload = async (file) => {
    const url = await upload(file)
    if (!url) return
    handlePickPhoto(url)
  }

  // Swap-mode: pick any other photo on the canvas to swap urls with the selected one
  const swapCandidates = useMemo(() => {
    if (photoMode !== 'swap' || !selectedId) return []
    return (currentPage?.elements || []).filter((el) => el.type === 'photo' && el.id !== selectedId && el.url)
  }, [photoMode, selectedId, currentPage])

  const handlePickSwapTarget = (otherId) => {
    if (!selectedId) return
    dispatch({ type: 'SWAP_PHOTOS', idA: selectedId, idB: otherId })
    setPhotoMode('idle')
  }

  // Action bar handlers
  const handleActionDone = () => {
    dispatch({ type: 'SELECT', id: null })
    setPhotoMode('idle')
  }
  const handleActionChange = () => setPhotoMode((m) => (m === 'replace' ? 'idle' : 'replace'))
  const handleActionSwap = () => setPhotoMode((m) => (m === 'swap' ? 'idle' : 'swap'))
  const handleActionRotate = () => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { rotation: ((selectedElement.rotation || 0) + 90) % 360 })
  }
  const handleActionFlip = () => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { flipped: !selectedElement.flipped })
  }
  const handleActionScale = (newScale) => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { imageScale: newScale })
  }
  const handleActionRemovePicture = () => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { url: null, isSlot: true, imageScale: 1, flipped: false })
    setPhotoMode('fill')
  }
  const handleActionRemove = () => {
    if (!selectedElement) return
    handleDeleteElement(selectedId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-kaydo" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <p className="text-bark font-semibold">{loadError}</p>
        <button onClick={() => navigate('/scrapbook')} className="btn-kaydo">Back to Scrapbooks</button>
      </div>
    )
  }

  // When in swap mode, the action bar asks "pick another photo on the page to swap".
  const swapHint = photoMode === 'swap'
    ? (swapCandidates.length > 0
        ? 'Tap another photo on the page to swap'
        : 'No other photos on this page to swap with')
    : undefined

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-cream">
      {/* Top toolbar */}
      <EditorToolbar
        title={title}
        onTitleChange={handleTitleChange}
        saveStatus={saveStatus}
        onUndo={handleUndo}
        canUndo={history.length > 0}
        pages={pages}
        currentPageIndex={currentPageIndex}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        onSwitchPage={handleSwitchPage}
        onExportPDF={handleExportPDF}
        exporting={exporting}
      />

      {/* Canvas area — fits available space, no scroll */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-3 lg:p-6">
        <ScrapbookCanvas
          ref={canvasRef}
          page={currentPage}
          selectedId={selectedId}
          onSelectElement={handleSelectElement}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
          editable={editable}
          exporting={exporting}
        />
      </div>

      {/* Bottom stack: page nav → context bar → tools */}
      <div className="flex-shrink-0">
        <PageNavBar
          pages={pages}
          currentPageIndex={currentPageIndex}
          onSwitchPage={handleSwitchPage}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
        />

        {photoMode === 'replace' && isPhotoSelected ? (
          <PhotoBar
            memoryPhotos={memoryPhotos}
            sessionPhotos={sessionPhotos}
            onUpload={handleUpload}
            onPick={handlePickPhoto}
            uploading={uploading}
            mode="replace"
          />
        ) : isPhotoSelected ? (
          <PhotoActionBar
            element={selectedElement}
            onDone={handleActionDone}
            onChange={handleActionChange}
            onSwap={handleActionSwap}
            onRotate={handleActionRotate}
            onFlip={handleActionFlip}
            onScale={handleActionScale}
            onRemovePicture={handleActionRemovePicture}
            onRemove={handleActionRemove}
            mode={photoMode}
          />
        ) : (
          <PhotoBar
            memoryPhotos={memoryPhotos}
            sessionPhotos={sessionPhotos}
            onUpload={handleUpload}
            onPick={handlePickPhoto}
            uploading={uploading}
            mode={isSlotSelected ? 'fill' : 'idle'}
          />
        )}

        {/* Swap helper strip — shown when selecting a swap target */}
        {photoMode === 'swap' && (
          <div className="bg-warm-white border-t border-cream-dark px-4 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-[11px] font-medium text-kaydo whitespace-nowrap">{swapHint}</span>
            {swapCandidates.map((el) => (
              <button
                key={el.id}
                type="button"
                onClick={() => handlePickSwapTarget(el.id)}
                className="flex-shrink-0 px-2 py-1 rounded-lg border border-cream-dark bg-cream hover:border-kaydo hover:bg-kaydo/5 text-[11px] text-bark"
              >
                Photo {(currentPage.elements.indexOf(el) + 1)}
              </button>
            ))}
          </div>
        )}

        <BottomToolRow
          currentPage={currentPage}
          customizable={editable}
          onToggleCustomize={handleToggleCustomize}
          onAddElement={handleAddElement}
          onApplyLayout={handleApplyLayout}
          onChangeBackground={handleChangeBackground}
        />
      </div>
    </div>
  )
}
