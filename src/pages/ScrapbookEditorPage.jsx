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
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ─── Editor state reducer ─────────────────────────────────────────────────────

const MAX_HISTORY = 20

function makeBlankPage() {
  return { id: crypto.randomUUID(), backgroundColor: '#FDF6EC', backgroundPattern: 'none', elements: [] }
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
      return withHistory([...pages, makeBlankPage()])

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

    case 'APPLY_LAYOUT':
      return updateCurrentPage((p) => ({ ...p, elements: action.elements }))

    case 'CHANGE_BACKGROUND':
      return updateCurrentPage((p) => ({ ...p, ...action.updates }))

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
  const { familyId } = useAuth()
  const { updateScrapbook } = useScrapbooks(familyId)

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

  // Load scrapbook once on mount
  useEffect(() => {
    if (!id || !db) { setLoading(false); return }
    getDoc(doc(db, 'scrapbooks', id)).then((snap) => {
      if (!snap.exists()) { setLoadError('Scrapbook not found'); setLoading(false); return }
      const data = snap.data()
      dispatch({ type: 'LOAD', pages: data.pages || [makeBlankPage()], title: data.title || 'My Scrapbook' })
      setLoading(false)
    }).catch((err) => {
      setLoadError(err.message)
      setLoading(false)
    })
  }, [id])

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
    try {
      await document.fonts.ready
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] })

      for (let i = 0; i < pages.length; i++) {
        // Switch page and wait for React to flush
        if (i !== currentPageIndex) {
          dispatch({ type: 'SWITCH_PAGE', index: i })
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        }
        const canvas = await html2canvas(canvasRef.current, {
          useCORS: true,
          scale: 2,
          backgroundColor: null,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage([800, 600], 'landscape')
        pdf.addImage(imgData, 'JPEG', 0, 0, 800, 600)
      }

      // Switch back to original page
      if (currentPageIndex !== pages.length - 1) {
        dispatch({ type: 'SWITCH_PAGE', index: currentPageIndex })
      }

      pdf.save(`${title}.pdf`)
    } catch (err) {
      console.error('PDF export failed', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAddElement = (element) => dispatch({ type: 'ADD_ELEMENT', element })
  const handleUpdateElement = (id, updates) => dispatch({ type: 'UPDATE_ELEMENT', id, updates })
  const handleDeleteElement = (id) => dispatch({ type: 'DELETE_ELEMENT', id })
  const handleApplyLayout = (elements) => dispatch({ type: 'APPLY_LAYOUT', elements })
  const handleChangeBackground = (updates) => dispatch({ type: 'CHANGE_BACKGROUND', updates })
  const handleSelectElement = (id) => dispatch({ type: 'SELECT', id })
  const handleUndo = () => dispatch({ type: 'UNDO' })
  const handleAddPage = () => dispatch({ type: 'ADD_PAGE' })
  const handleDeletePage = (index) => dispatch({ type: 'DELETE_PAGE', index })
  const handleSwitchPage = (index) => dispatch({ type: 'SWITCH_PAGE', index })
  const handleTitleChange = (newTitle) => dispatch({ type: 'SET_TITLE', title: newTitle })

  const currentPage = pages[currentPageIndex] || pages[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-hearth" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <p className="text-bark font-semibold">{loadError}</p>
        <button onClick={() => navigate('/scrapbook')} className="btn-hearth">Back to Scrapbooks</button>
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
        <div className="flex-1 flex flex-col items-center justify-start overflow-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <ScrapbookCanvas
            ref={canvasRef}
            page={currentPage}
            selectedId={selectedId}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
          />

          {/* Page strip — mobile page navigation */}
          <div className="flex items-center gap-2 mt-4 lg:hidden">
            {pages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => handleSwitchPage(i)}
                className={`w-8 h-8 rounded-lg border-2 text-xs font-bold transition-colors ${
                  i === currentPageIndex
                    ? 'border-hearth bg-hearth text-white'
                    : 'border-cream-dark bg-warm-white text-bark-muted'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={handleAddPage}
              className="w-8 h-8 rounded-lg border-2 border-dashed border-hearth text-hearth flex items-center justify-center text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

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
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-bark-muted hover:text-hearth transition-colors"
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
