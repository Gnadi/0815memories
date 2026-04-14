import { useState, useEffect } from 'react'
import { LayoutGrid, Type, Smile, Palette, Unlock, Lock, X } from 'lucide-react'
import LayoutsPanel from './panels/LayoutsPanel'
import TextPanel from './panels/TextPanel'
import StickersPanel from './panels/StickersPanel'
import BackgroundPanel from './panels/BackgroundPanel'

const TOOLS = [
  { id: 'layouts', icon: LayoutGrid, label: 'Layouts' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'stickers', icon: Smile, label: 'Stickers' },
  { id: 'background', icon: Palette, label: 'Background' },
]

/**
 * Small secondary toolbar underneath the photo bar. Opens a bottom sheet
 * (mobile) / floating popover (desktop) with the chosen panel.
 */
export default function BottomToolRow({
  currentPage,
  customizable,
  onToggleCustomize,
  onAddElement,
  onApplyLayout,
  onChangeBackground,
}) {
  const [openPanel, setOpenPanel] = useState(null)

  // Close panel on Esc
  useEffect(() => {
    if (!openPanel) return
    const onKey = (e) => { if (e.key === 'Escape') setOpenPanel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPanel])

  const closeAndRun = (fn) => (arg) => {
    fn(arg)
    setOpenPanel(null)
  }

  const renderPanel = () => {
    switch (openPanel) {
      case 'layouts':
        return (
          <LayoutsPanel
            onApplyLayout={closeAndRun(onApplyLayout)}
            hasExistingElements={(currentPage?.elements?.length || 0) > 0}
          />
        )
      case 'text':
        return <TextPanel onAddElement={closeAndRun(onAddElement)} />
      case 'stickers':
        return <StickersPanel onAddElement={closeAndRun(onAddElement)} />
      case 'background':
        return (
          <BackgroundPanel
            onChangeBackground={onChangeBackground}
            currentBackgroundColor={currentPage?.backgroundColor}
            currentPattern={currentPage?.backgroundPattern || 'none'}
          />
        )
      default:
        return null
    }
  }

  const panelTitle = openPanel ? TOOLS.find((t) => t.id === openPanel)?.label || '' : ''

  return (
    <>
      <div className="bg-warm-white border-t border-cream-dark flex items-stretch">
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpenPanel((cur) => (cur === id ? null : id))}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              openPanel === id
                ? 'text-kaydo bg-kaydo/5'
                : 'text-bark-light hover:text-kaydo'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onToggleCustomize}
          title={customizable ? 'Lock layout (photos snap to slots)' : 'Unlock layout (drag/resize photos)'}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
            customizable
              ? 'text-kaydo bg-kaydo/10'
              : 'text-bark-light hover:text-kaydo'
          }`}
        >
          {customizable ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          <span>{customizable ? 'Free' : 'Locked'}</span>
        </button>
      </div>

      {openPanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpenPanel(null)}
          />
          <div
            className="fixed z-50 bg-warm-white shadow-2xl flex flex-col
              left-0 right-0 bottom-0 rounded-t-2xl max-h-[70vh]
              lg:left-auto lg:right-6 lg:bottom-36 lg:w-[360px] lg:rounded-2xl lg:max-h-[70vh]"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-cream-dark">
              <h3 className="text-sm font-semibold text-bark">{panelTitle}</h3>
              <button
                type="button"
                onClick={() => setOpenPanel(null)}
                className="p-1 rounded-lg hover:bg-cream text-bark-muted hover:text-bark"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderPanel()}
            </div>
          </div>
        </>
      )}
    </>
  )
}
