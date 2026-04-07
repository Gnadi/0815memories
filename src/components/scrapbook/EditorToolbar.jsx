import { useState } from 'react'
import { ArrowLeft, Undo2, FileDown, Share2, Loader2, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function EditorToolbar({
  title,
  onTitleChange,
  saveStatus,
  onUndo,
  canUndo,
  pages,
  currentPageIndex,
  onAddPage,
  onDeletePage,
  onSwitchPage,
  onExportPDF,
  exporting,
}) {
  const navigate = useNavigate()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)

  const commitTitle = () => {
    setEditingTitle(false)
    if (titleDraft.trim()) onTitleChange(titleDraft.trim())
    else setTitleDraft(title)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-warm-white border-b border-cream-dark z-20 flex-shrink-0">
      {/* Back */}
      <button
        onClick={() => navigate('/scrapbook')}
        className="p-1.5 rounded-lg hover:bg-cream text-bark-muted hover:text-bark transition-colors flex-shrink-0"
        title="Back to Scrapbooks"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(title) } }}
            className="w-full bg-cream rounded-lg px-2 py-1 text-sm font-semibold text-bark outline-none border border-kaydo"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(title); setEditingTitle(true) }}
            className="text-sm font-semibold text-bark hover:text-kaydo truncate block max-w-full text-left"
            title="Click to rename"
          >
            {title}
          </button>
        )}
      </div>

      {/* Page navigation — compact on mobile */}
      <div className="hidden sm:flex items-center gap-1 bg-cream rounded-lg px-1.5 py-1 flex-shrink-0">
        <button
          onClick={() => onSwitchPage(Math.max(0, currentPageIndex - 1))}
          disabled={currentPageIndex === 0}
          className="p-0.5 rounded disabled:opacity-30 hover:bg-cream-dark transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-bark" />
        </button>
        <span className="text-xs font-medium text-bark min-w-[60px] text-center">
          {currentPageIndex + 1} / {pages.length}
        </span>
        <button
          onClick={() => onSwitchPage(Math.min(pages.length - 1, currentPageIndex + 1))}
          disabled={currentPageIndex === pages.length - 1}
          className="p-0.5 rounded disabled:opacity-30 hover:bg-cream-dark transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-bark" />
        </button>
        <button
          onClick={onAddPage}
          className="p-0.5 ml-0.5 rounded hover:bg-cream-dark transition-colors"
          title="Add page"
        >
          <Plus className="w-4 h-4 text-kaydo" />
        </button>
        {pages.length > 1 && (
          <button
            onClick={() => {
              if (confirm('Delete this page?')) onDeletePage(currentPageIndex)
            }}
            className="p-0.5 rounded hover:bg-red-50 text-bark-muted hover:text-red-500 transition-colors"
            title="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Save status */}
      <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-xs text-bark-muted">
        {saveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saveStatus === 'saved' && <Check className="w-3.5 h-3.5 text-green-500" />}
        <span className="hidden md:inline">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-1.5 rounded-lg hover:bg-cream text-bark-muted hover:text-bark transition-colors disabled:opacity-30 flex-shrink-0"
        title="Undo"
      >
        <Undo2 className="w-4 h-4" />
      </button>

      {/* Export PDF */}
      <button
        onClick={onExportPDF}
        disabled={exporting}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cream hover:bg-cream-dark text-bark text-xs font-medium transition-colors flex-shrink-0"
        title="Export as PDF"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        <span className="hidden sm:inline">PDF</span>
      </button>

      {/* Share */}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(window.location.href)
            .then(() => alert('Link copied to clipboard!'))
            .catch(() => {})
        }}
        className="p-1.5 rounded-lg hover:bg-cream text-bark-muted hover:text-bark transition-colors flex-shrink-0"
        title="Copy share link"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  )
}
