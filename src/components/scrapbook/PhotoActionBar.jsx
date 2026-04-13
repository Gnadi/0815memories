import { useState } from 'react'
import {
  Check,
  Camera,
  ArrowLeftRight,
  Maximize2,
  RotateCw,
  FlipHorizontal,
  ImageOff,
  Trash2,
} from 'lucide-react'

// Bottom action bar shown while a photo element (filled layout slot or
// free-floating photo) is selected. Purely presentational — all state and
// reducer dispatches live in ScrapbookEditorPage.
export default function PhotoActionBar({
  onDone,
  onChange,
  onSwap,
  onScale,
  onRotate,
  onFlip,
  onRemoveImage,
  onRemove,
  swapActive,
}) {
  const [showScale, setShowScale] = useState(false)
  const [scaleFactor, setScaleFactor] = useState(1)

  const actions = [
    { icon: Camera, label: 'Change\nphotos', onClick: onChange },
    {
      icon: ArrowLeftRight,
      label: swapActive ? 'Cancel\nswap' : 'Swap\nphotos',
      onClick: onSwap,
      active: swapActive,
    },
    {
      icon: Maximize2,
      label: 'Scale',
      onClick: () => {
        setScaleFactor(1)
        setShowScale((v) => !v)
      },
      active: showScale,
    },
    { icon: RotateCw, label: 'Rotate', onClick: onRotate },
    { icon: FlipHorizontal, label: 'Flip', onClick: onFlip },
    { icon: ImageOff, label: 'Remove\nimage', onClick: onRemoveImage },
    { icon: Trash2, label: 'Remove', onClick: onRemove },
  ]

  const commitScale = () => {
    if (scaleFactor !== 1) onScale(scaleFactor)
    setShowScale(false)
    setScaleFactor(1)
  }

  return (
    <div className="w-full mt-4 relative">
      {showScale && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-16 bg-warm-white border border-cream-dark rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 z-20">
          <span className="text-xs font-semibold text-bark-muted">Scale</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
            onPointerUp={commitScale}
            onBlur={commitScale}
            className="accent-kaydo w-48"
          />
          <span className="text-xs font-mono text-bark w-10 text-right">
            {Math.round(scaleFactor * 100)}%
          </span>
        </div>
      )}

      <div className="w-full bg-warm-white border border-cream-dark rounded-xl px-3 py-3 flex items-center gap-3 overflow-x-auto hide-scrollbar">
        <button
          onClick={onDone}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-bark text-warm-white min-w-[64px] active:scale-95 transition-transform"
        >
          <Check className="w-6 h-6" />
          <span className="text-[11px] font-semibold">Done</span>
        </button>
        {actions.map(({ icon: Icon, label, onClick, active }) => (
          <button
            key={label}
            onClick={onClick}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[64px] transition-colors active:scale-95 ${
              active
                ? 'bg-kaydo/15 text-kaydo'
                : 'text-bark-muted hover:text-kaydo hover:bg-cream'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-pre-line text-center leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
