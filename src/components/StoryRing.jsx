import React from 'react'

/**
 * Circular story ring — "Daily Moments" style.
 * @param {object} props
 * @param {string} props.image - image URL
 * @param {string} props.label - display label ("Today", "Yesterday", date)
 * @param {boolean} props.isAdd - show the "Add" placeholder
 * @param {boolean} props.hasRing - show the colored ring border
 * @param {function} props.onClick
 */
export default function StoryRing({ image, label, isAdd, hasRing = true, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none group"
    >
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-105 ${
          isAdd
            ? 'border-2 border-dashed border-hearth-border bg-hearth-bg'
            : hasRing
            ? 'ring-2 ring-terra ring-offset-2 ring-offset-hearth-bg'
            : 'ring-2 ring-hearth-border ring-offset-2 ring-offset-hearth-bg'
        }`}
      >
        {isAdd ? (
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-hearth-muted" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ) : (
          <img
            src={image}
            alt={label}
            className="w-full h-full object-cover rounded-full"
          />
        )}
      </div>
      <span
        className={`text-xs font-medium truncate max-w-[3.5rem] ${
          isAdd ? 'text-hearth-muted' : hasRing ? 'text-hearth-text font-semibold' : 'text-hearth-muted'
        }`}
      >
        {label}
      </span>
    </button>
  )
}
