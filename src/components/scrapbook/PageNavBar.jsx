import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react'

/**
 * Previous page · Page X · Next page — the row just under the canvas.
 * Clicking the centre label opens a small page index sheet.
 */
export default function PageNavBar({
  pages,
  currentPageIndex,
  onSwitchPage,
  onAddPage,
  onDeletePage,
}) {
  const [open, setOpen] = useState(false)
  const pageLabel = currentPageIndex === 0
    ? `Cover / ${pages.length}`
    : `Page ${currentPageIndex + 1} / ${pages.length}`

  return (
    <>
      <div className="flex items-stretch bg-warm-white border-t border-cream-dark">
        <button
          type="button"
          disabled={currentPageIndex === 0}
          onClick={() => onSwitchPage(Math.max(0, currentPageIndex - 1))}
          className="flex items-center justify-center gap-1 flex-1 py-3 text-sm font-medium text-bark-light hover:text-kaydo disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous page</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-1 flex-1 py-3 text-sm font-semibold text-bark hover:text-kaydo border-x border-cream-dark"
        >
          <span>{pageLabel}</span>
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={currentPageIndex >= pages.length - 1}
          onClick={() => onSwitchPage(Math.min(pages.length - 1, currentPageIndex + 1))}
          className="flex items-center justify-center gap-1 flex-1 py-3 text-sm font-medium text-bark-light hover:text-kaydo disabled:opacity-30 disabled:pointer-events-none"
        >
          <span>Next page</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-warm-white shadow-2xl flex flex-col
            left-0 right-0 bottom-0 rounded-t-2xl max-h-[55vh]
            lg:left-1/2 lg:-translate-x-1/2 lg:right-auto lg:bottom-28 lg:w-[420px] lg:rounded-2xl">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-cream-dark">
              <h3 className="text-sm font-semibold text-bark">Pages</h3>
              <button
                type="button"
                onClick={() => { onAddPage(); }}
                className="flex items-center gap-1 text-xs font-medium text-kaydo hover:text-kaydo-dark"
              >
                <Plus className="w-4 h-4" /> Add page
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {pages.map((p, i) => (
                <div key={p.id} className="relative">
                  <button
                    type="button"
                    onClick={() => { onSwitchPage(i); setOpen(false) }}
                    className={`w-full aspect-[4/3] rounded-xl border-2 text-xs font-bold transition-colors flex items-center justify-center ${
                      i === currentPageIndex
                        ? 'border-kaydo bg-kaydo/10 text-kaydo'
                        : 'border-cream-dark bg-cream text-bark hover:border-kaydo'
                    }`}
                  >
                    {i === 0 ? 'Cover' : `Page ${i + 1}`}
                  </button>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this page?')) onDeletePage(i)
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-cream-dark rounded-full flex items-center justify-center text-bark-muted hover:text-red-500 shadow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
