import { useState, useEffect, useRef, useCallback, useReducer } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Image, Smile, Type, LayoutGrid, Palette, Loader2 } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { useScrapbooks } from '../hooks/useScrapbooks'
import ScrapbookCanvas from '../components/scrapbook/ScrapbookCanvas'
import EditorSidebar from '../components/scrapbook/EditorSidebar'
import EditorToolbar from '../components/scrapbook/EditorToolbar'
import { encryptAndUpload } from '../utils/encryptedUpload'
import { DEFAULT_NEW_PAGE_LAYOUT, cloneLayoutElements } from '../utils/layouts'
import {
  spreadForPageIndex,
  totalSpreads,
  spreadBounds,
  leftPageForSpread,
  sideForPageIndex,
} from '../utils/spread'
import MemoryPhotoStrip from '../components/scrapbook/MemoryPhotoStrip'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ─── Editor state reducer ─────────────────────────────────────────────────────

const MAX_HISTORY = 20

function makeBlankPage() {
  return { id: crypto.randomUUID(), backgroundColor: '#FDF6EC', backgroundPattern: 'none', elements: [] }
}

// New pages added via the "+" button arrive with a default layout already
// applied (empty photo slots). Users can still change the layout afterwards
// from the Layouts tab.
function makePrefilledPage() {
  return {
    id: crypto.randomUUID(),
    backgroundColor: '#FDF6EC',
    backgroundPattern: 'none',
    elements: cloneLayoutElements(DEFAULT_NEW_PAGE_LAYOUT),
  }
}

function editorReducer(state, action) {
  const { pages, currentPageIndex } = state

  const withHistory = (newPages) => {
    const history = [pages, ...state.history].slice(0, MAX_HISTORY)
    return { ...state, pages: newPages, history, isDirty: true }
  }

  const updatePageAt = (idx, updater) => {
    if (idx == null || idx < 0 || idx >= pages.length) return state
    const newPages = pages.map((p, i) => (i === idx ? updater(p) : p))
    return withHistory(newPages)
  }

  switch (action.type) {
    case 'LOAD':
      return { ...state, pages: action.pages, title: action.title ?? state.title, isDirty: false, history: [] }

    case 'SET_TITLE':
      return { ...state, title: action.title, isDirty: true }

    case 'SWITCH_PAGE':
      return { ...state, currentPageIndex: action.index, selectedId: null }

    case 'ADD_PAGE': {
      // Always add two pages so each tap creates a complete facing spread,
      // both prefilled with the default layout.
      const newPages = [...pages, makePrefilledPage(), makePrefilledPage()]
      const next = withHistory(newPages)
      // Jump to the first of the new pages so the user sees what was added.
      return { ...next, currentPageIndex: pages.length, selectedId: null }
    }

    case 'DELETE_PAGE': {
      if (pages.length <= 1) return state
      const newPages = pages.filter((_, i) => i !== action.index)
      const newIndex = Math.min(currentPageIndex, newPages.length - 1)
      return { ...withHistory(newPages), currentPageIndex: newIndex, selectedId: null }
    }

    case 'ADD_ELEMENT': {
      const idx = action.pageIndex ?? currentPageIndex
      return updatePageAt(idx, (p) => ({
        ...p,
        elements: [...p.elements, { id: crypto.randomUUID(), ...action.element }],
      }))
    }

    case 'UPDATE_ELEMENT': {
      const idx = action.pageIndex ?? currentPageIndex
      return updatePageAt(idx, (p) => ({
        ...p,
        elements: p.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.updates } : el
        ),
      }))
    }

    case 'DELETE_ELEMENT': {
      const idx = action.pageIndex ?? currentPageIndex
      return updatePageAt(idx, (p) => ({
        ...p,
        elements: p.elements.filter((el) => el.id !== action.id),
      }))
    }

    case 'APPLY_LAYOUT': {
      const idx = action.pageIndex ?? currentPageIndex
      return updatePageAt(idx, (p) => ({ ...p, elements: action.elements }))
    }

    case 'CHANGE_BACKGROUND': {
      const idx = action.pageIndex ?? currentPageIndex
      return updatePageAt(idx, (p) => ({ ...p, ...action.updates }))
    }

    case 'SELECT':
      return {
        ...state,
        selectedId: action.id,
        currentPageIndex: action.pageIndex ?? state.currentPageIndex,
      }

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
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [exporting, setExporting] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [mobileSidebarTab, setMobileSidebarTab] = useState('photos')

  const canvasRef = useRef(null)
  const saveTimerRef = useRef(null)
  const slotFileInputRef = useRef(null)
  const pendingSlotRef = useRef(null) // { pageIndex, elementId }
  const [uploadingSlotId, setUploadingSlotId] = useState(null)

  // Load scrapbook once on mount
  useEffect(() => {
    if (!id || !db) { setLoading(false); return }
    getDoc(doc(db, 'scrapbooks', id)).then(async (snap) => {
      if (!snap.exists()) { setLoadError('Scrapbook not found'); setLoading(false); return }
      const raw = snap.data()
      if (raw.familyId !== familyId) { setLoadError('Scrapbook not found'); setLoading(false); return }
      // Decrypt title and pages
      let title = raw.title || 'My Scrapbook'
      let pages = raw.pages || [makeBlankPage()]
      if (encryptionKey) {
        const { decryptText, decryptJSON } = await import('../utils/encryption')
        if (typeof title === 'string') title = await decryptText(encryptionKey, title)
        if (typeof pages === 'string') pages = await decryptJSON(encryptionKey, pages)
      }
      dispatch({ type: 'LOAD', pages, title })
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
      // Find first photo URL for cover
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

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!canvasRef.current) return
    setExporting(true)
    const originalIndex = currentPageIndex
    try {
      await document.fonts.ready
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [600, 900] })

      for (let i = 0; i < pages.length; i++) {
        // Activate page i so the spread contains it and the imperative
        // handle can hand us the correct side's DOM node.
        dispatch({ type: 'SWITCH_PAGE', index: i })
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

        const node = canvasRef.current?.getPageNode(sideForPageIndex(i))
        if (!node) continue

        const canvas = await html2canvas(node, {
          useCORS: true,
          scale: 2,
          backgroundColor: null,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage([600, 900], 'portrait')
        pdf.addImage(imgData, 'JPEG', 0, 0, 600, 900)
      }

      // Restore original active page
      dispatch({ type: 'SWITCH_PAGE', index: originalIndex })

      pdf.save(`${title}.pdf`)
    } catch (err) {
      console.error('PDF export failed', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  // Sidebar actions target the currently-active page (currentPageIndex)
  const handleAddElement = (element) => dispatch({ type: 'ADD_ELEMENT', element })
  const handleApplyLayout = (elements) => dispatch({ type: 'APPLY_LAYOUT', elements })
  const handleChangeBackground = (updates) => dispatch({ type: 'CHANGE_BACKGROUND', updates })

  // Canvas actions receive the page index explicitly so either spread page can
  // be manipulated without a stale currentPageIndex.
  const handleUpdateElement = (pageIndex, id, updates) =>
    dispatch({ type: 'UPDATE_ELEMENT', pageIndex, id, updates })
  const handleDeleteElement = (pageIndex, id) =>
    dispatch({ type: 'DELETE_ELEMENT', pageIndex, id })
  const handleSelectElement = (pageIndex, id) =>
    dispatch({ type: 'SELECT', pageIndex, id })

  const handleUndo = () => dispatch({ type: 'UNDO' })
  const handleAddPage = () => dispatch({ type: 'ADD_PAGE' })
  const handleDeletePage = (index) => dispatch({ type: 'DELETE_PAGE', index })
  const handleSwitchPage = (index) => dispatch({ type: 'SWITCH_PAGE', index })
  const handleTitleChange = (newTitle) => dispatch({ type: 'SET_TITLE', title: newTitle })

  // Tapping a layout slot (empty photo element) triggers the file picker.
  const handleSlotClick = (pageIndex, elementId) => {
    if (uploadingSlotId) return
    pendingSlotRef.current = { pageIndex, elementId }
    slotFileInputRef.current?.click()
  }

  const handleSlotFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const pending = pendingSlotRef.current
    pendingSlotRef.current = null
    if (!file || !pending) return
    const { pageIndex, elementId } = pending
    setUploadingSlotId(elementId)
    try {
      const { url } = await encryptAndUpload(file, encryptionKey)
      // URL is all we change — slot x/y/width/height are preserved so the
      // photo fills the tapped box exactly.
      dispatch({ type: 'UPDATE_ELEMENT', pageIndex, id: elementId, updates: { url } })
    } catch (err) {
      console.error('Slot upload failed', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploadingSlotId(null)
    }
  }

  // Clicking a photo in the "Photos from memories" strip: if an empty slot is
  // selected it fills that slot; otherwise adds a free-floating photo to the
  // currently active page.
  const handleAddMemoryPhoto = (url) => {
    const activePage = pages[currentPageIndex]
    if (selectedId && activePage) {
      const slot = activePage.elements.find(
        (el) => el.id === selectedId && el.type === 'photo' && !el.url
      )
      if (slot) {
        dispatch({
          type: 'UPDATE_ELEMENT',
          pageIndex: currentPageIndex,
          id: selectedId,
          updates: { url },
        })
        return
      }
    }
    dispatch({
      type: 'ADD_ELEMENT',
      element: {
        type: 'photo',
        url,
        x: 60,
        y: 80,
        width: 300,
        height: 300,
        rotation: 0,
        polaroid: false,
        caption: '',
        zIndex: Date.now(),
      },
    })
  }

  // Derive spread state
  const spreadIdx = spreadForPageIndex(currentPageIndex)
  const { left: leftPageIndex, right: rightPageIndex } = spreadBounds(pages.length, spreadIdx)
  const leftPage = leftPageIndex != null ? pages[leftPageIndex] : null
  const rightPage = rightPageIndex != null ? pages[rightPageIndex] : null
  const activeSide = currentPageIndex === rightPageIndex ? 'right' : 'left'

  const handleActivateSide = (side) => {
    const targetIdx = side === 'right' ? rightPageIndex : leftPageIndex
    if (targetIdx != null && targetIdx !== currentPageIndex) {
      dispatch({ type: 'SWITCH_PAGE', index: targetIdx })
    }
  }

  const spreadCount = totalSpreads(pages.length)

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-cream">
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

      {/* Editor body */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex flex-col w-64 flex-shrink-0">
          <EditorSidebar
            onAddElement={handleAddElement}
            onApplyLayout={handleApplyLayout}
            onChangeBackground={handleChangeBackground}
          />
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex flex-col items-center justify-start overflow-auto px-1 pt-2 pb-20 lg:px-6 lg:pt-6 lg:pb-6">
          <ScrapbookCanvas
            ref={canvasRef}
            leftPage={leftPage}
            rightPage={rightPage}
            leftPageIndex={leftPageIndex}
            rightPageIndex={rightPageIndex}
            activeSide={activeSide}
            onActivate={handleActivateSide}
            selectedId={selectedId}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onSlotClick={handleSlotClick}
            uploadingSlotId={uploadingSlotId}
          />

          {/* Photos from the family's memories + moments for easy reuse */}
          <MemoryPhotoStrip onPhotoClick={handleAddMemoryPhoto} />

          {/* Spread strip — mobile navigation */}
          <div className="flex items-center gap-2 mt-4 lg:hidden flex-wrap justify-center max-w-full px-2">
            {Array.from({ length: spreadCount }).map((_, i) => {
              const { left, right } = spreadBounds(pages.length, i)
              const label = i === 0 ? 'Cover' : right == null ? `${left + 1}` : `${left + 1}-${right + 1}`
              const isActive = i === spreadIdx
              return (
                <button
                  key={i}
                  onClick={() => handleSwitchPage(leftPageForSpread(i))}
                  className={`px-2 h-8 rounded-lg border-2 text-xs font-bold transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-kaydo bg-kaydo text-white'
                      : 'border-cream-dark bg-warm-white text-bark-muted'
                  }`}
                >
                  {label}
                </button>
              )
            })}
            <button
              onClick={handleAddPage}
              className="w-8 h-8 rounded-lg border-2 border-dashed border-kaydo text-kaydo flex items-center justify-center text-lg font-bold"
              title="Add page"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input used by layout slot "Tap to add photo" taps */}
      <input
        ref={slotFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSlotFileChange}
      />

      {/* Mobile bottom toolbar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-warm-white border-t border-cream-dark">
        <div className="flex items-center justify-around px-4 py-2">
          {[
            { id: 'photos', icon: Image, label: 'Photos' },
            { id: 'stickers', icon: Smile, label: 'Stickers' },
            { id: 'text', icon: Type, label: 'Text' },
            { id: 'layouts', icon: LayoutGrid, label: 'Layouts' },
            { id: 'background', icon: Palette, label: 'BG' },
          ].map(({ id: tabId, icon: Icon, label }) => (
            <button
              key={tabId}
              onClick={() => {
                setMobileSidebarTab(tabId)
                setShowMobileSidebar(true)
              }}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-bark-muted hover:text-kaydo transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile sidebar bottom sheet */}
      {showMobileSidebar && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-warm-white rounded-t-2xl"
            style={{ maxHeight: '65vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-cream-dark" />
            </div>
            <div className="flex-1 overflow-hidden">
              <EditorSidebar
                onAddElement={(el) => { handleAddElement(el); setShowMobileSidebar(false) }}
                onApplyLayout={(els) => { handleApplyLayout(els); setShowMobileSidebar(false) }}
                onChangeBackground={(updates) => { handleChangeBackground(updates); setShowMobileSidebar(false) }}
                isMobile
                onClose={() => setShowMobileSidebar(false)}
                initialTab={mobileSidebarTab}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
