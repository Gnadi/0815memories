import { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { flushSync } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { useScrapbookWriter } from '../hooks/useScrapbooks'
import { useMemoryPhotos } from '../hooks/useMemoryPhotos'
import { useScrapbookPhotoUpload } from '../hooks/useScrapbookPhotoUpload'
import ScrapbookCanvas from '../components/scrapbook/ScrapbookCanvas'
import EditorToolbar from '../components/scrapbook/EditorToolbar'
import PhotoBar from '../components/scrapbook/PhotoBar'
import PhotoActionBar from '../components/scrapbook/PhotoActionBar'
import BottomToolRow from '../components/scrapbook/BottomToolRow'
import PageNavBar from '../components/scrapbook/PageNavBar'
import { devError } from '../utils/devLog'
import { exportFileName } from '../utils/helpers'
import { EXPORT_PIXEL_RATIO } from '../utils/canvasText'
import { waitForExportCanvases, EXPORT_PENDING_TIMEOUT_MS } from '../components/scrapbook/exportReady'
import { prefetchDecryptedMedia } from '../components/media/useDecryptedMedia'
import { editorReducer, initialState, makeBlankPage, FRESH_CROP } from '../components/scrapbook/editorState'

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScrapbookEditorPage() {
  const { t } = useTranslation('scrapbook')
  const { id } = useParams()
  const navigate = useNavigate()
  const { familyId, encryptionKey } = useAuth()
  // Writer-only: the editor loads its one scrapbook itself, so subscribing here
  // would live-decrypt the full page JSON of every other scrapbook while editing.
  const { updateScrapbook } = useScrapbookWriter(familyId, encryptionKey)

  const [state, dispatch] = useReducer(editorReducer, initialState)
  const { pages, currentPageIndex, selectedId, isDirty, title, history } = state

  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [exporting, setExporting] = useState(false)
  // Photo bar interaction mode: 'idle' | 'fill' | 'replace' | 'swap'
  const [photoMode, setPhotoMode] = useState('idle')
  // The open panel of the photo action bar: 'crop' | 'polaroid' | null. While
  // the crop panel is open, dragging the selected photo moves the picture
  // inside its frame instead of moving the frame.
  const [photoPanel, setPhotoPanel] = useState(null)

  // Family memory photos + session uploads
  const { photos: memoryPhotos } = useMemoryPhotos(familyId, encryptionKey)
  const { upload, uploading, session: sessionPhotos } = useScrapbookPhotoUpload()

  const canvasRef = useRef(null)
  const saveTimerRef = useRef(null)

  // Load scrapbook once on mount
  useEffect(() => {
    if (!id || !db) { setLoading(false); return }
    getDoc(doc(db, 'scrapbooks', id)).then(async (snap) => {
      if (!snap.exists()) { setLoadError(t('errors.notFound')); setLoading(false); return }
      const raw = snap.data()
      if (raw.familyId !== familyId) { setLoadError(t('errors.notFound')); setLoading(false); return }
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
      // Backfill for books last saved before the page count was stored next to
      // the encrypted pages. The overview can't derive it without decrypting
      // the whole book; here the pages are decrypted anyway.
      if (raw.pageCount !== nextPages.length) {
        updateScrapbook(id, { pageCount: nextPages.length }).catch(() => {})
      }
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
    // Loaded on demand, while fonts and photos warm up below: jsPDF and
    // html2canvas are only ever needed here, and as static imports they were
    // most of what opening the editor downloaded.
    const libraries = Promise.all([import('jspdf'), import('html2canvas')])
    libraries.catch(() => {}) // awaited below; an earlier failure must not orphan it
    try {
      await document.fonts.ready
      // Warm every page's photos before the first capture. The editor only
      // mounts the page it is showing, so otherwise each page would start
      // fetching and decrypting its images at the moment it is captured.
      // Capped, so one photo that never arrives cannot hold the export here.
      await Promise.race([
        Promise.all(
          pages.flatMap((page) => (page.elements || [])
            .filter((el) => el.type === 'photo' && el.url)
            .map((el) => prefetchDecryptedMedia(el.url, encryptionKey, 'image/*')))
        ),
        new Promise((resolve) => setTimeout(resolve, EXPORT_PENDING_TIMEOUT_MS)),
      ])
      const [{ default: jsPDF }, { default: html2canvas }] = await libraries
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] })

      for (let i = 0; i < totalPages; i++) {
        // Force the page switch to commit synchronously so html2canvas reads
        // the freshly-rendered DOM instead of whatever was mounted before.
        flushSync(() => {
          dispatch({ type: 'SWITCH_PAGE', index: i })
        })
        // Wait 3 frames: one for the React commit to paint, one for passive
        // effects (canvas draw useEffect) to flush, one spare.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))
        // Frames alone are a guess; photos land on their canvas whenever their
        // decode finishes. Hold the capture until they actually have.
        await waitForExportCanvases(canvasRef.current)

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

        let pageCanvas
        try {
          pageCanvas = await html2canvas(el, {
            useCORS: true,
            // Photos and text are drawn onto <canvas> elements at this same
            // ratio, so their pixels land in the capture one for one.
            scale: EXPORT_PIXEL_RATIO,
            width: 800,
            height: 600,
            backgroundColor: null,
            logging: false,
          })
        } finally {
          el.style.transform = savedTransform
          el.style.transformOrigin = savedTransformOrigin
        }
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage([800, 600], 'landscape')
        pdf.addImage(imgData, 'JPEG', 0, 0, 800, 600)
      }

      // Restore the page the user was viewing before export.
      flushSync(() => {
        dispatch({ type: 'SWITCH_PAGE', index: originalPageIndex })
      })

      // Titled and stamped: every book starts life under the same default
      // title, so naming the file after the title alone would have each export
      // land on top of the last one.
      pdf.save(exportFileName(title, 'pdf', { fallback: 'Scrapbook' }))
    } catch (err) {
      devError('PDF export failed', err)
      alert(t('errors.pdfExportFailed'))
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
  const handleUpdateElement = (elementId, updates, gesture) => dispatch({ type: 'UPDATE_ELEMENT', id: elementId, updates, gesture })
  const handleDeleteElement = (elementId) => {
    dispatch({ type: 'DELETE_ELEMENT', id: elementId })
    setPhotoMode('idle')
  }
  const handleApplyLayout = (elements) => dispatch({ type: 'APPLY_LAYOUT', elements })
  const handleChangeBackground = (updates) => dispatch({ type: 'CHANGE_BACKGROUND', updates })

  const handleSelectElement = (elementId) => {
    if (elementId !== selectedId) setPhotoPanel(null)
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
      handleUpdateElement(selectedId, { url, isSlot: false, ...FRESH_CROP })
      setPhotoMode('idle')
      return
    }
    if (isPhotoSelected && photoMode === 'replace') {
      handleUpdateElement(selectedId, { url, ...FRESH_CROP })
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
    setPhotoPanel(null)
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
  // Slider ticks and keystrokes on one field of one photo are a single undo
  // step, like a drag on the canvas.
  const handleActionScale = (newScale) => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { imageScale: newScale, fit: null }, `zoom:${selectedId}`)
  }
  // Slider fields: a run of ticks on one of them is one undo step. Taps on a
  // filter or a colour stay a step each.
  const SLIDER_FIELDS = ['offsetX', 'offsetY', 'rotation', 'borderWidth', 'cornerRadius']
  const handleActionUpdate = (updates) => {
    if (!selectedElement) return
    const fields = Object.keys(updates)
    const gesture = fields.length === 1 && SLIDER_FIELDS.includes(fields[0]) ? `${fields[0]}:${selectedId}` : null
    handleUpdateElement(selectedId, updates, gesture)
  }
  const handleActionPolaroid = (on) => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { polaroid: on })
  }
  const handleActionCaption = (caption) => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { caption }, `caption:${selectedId}`)
  }
  const togglePhotoPanel = (panel) => setPhotoPanel((open) => (open === panel ? null : panel))
  const handleActionRemovePicture = () => {
    if (!selectedElement) return
    handleUpdateElement(selectedId, { url: null, isSlot: true, flipped: false, ...FRESH_CROP })
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
        <button onClick={() => navigate('/scrapbook')} className="btn-kaydo">{t('editor.backToScrapbooks')}</button>
      </div>
    )
  }

  // When in swap mode, the action bar asks "pick another photo on the page to swap".
  const swapHint = photoMode === 'swap'
    ? (swapCandidates.length > 0
        ? t('swap.tapToSwap')
        : t('swap.noOthers'))
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
          cropping={photoPanel === 'crop' && isPhotoSelected}
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
            onCrop={handleActionUpdate}
            onStyle={handleActionUpdate}
            onPolaroid={handleActionPolaroid}
            onCaption={handleActionCaption}
            panel={photoPanel}
            onTogglePanel={togglePhotoPanel}
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
                {t('swap.photoLabel', { number: currentPage.elements.indexOf(el) + 1 })}
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
