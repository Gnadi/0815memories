// The on/off switch the personal settings share.
export default function SettingSwitch({ on, onToggle, disabled = false, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      onClick={onToggle}
      disabled={disabled}
      className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60 ${
        on ? 'bg-kaydo' : 'bg-cream-dark'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-warm-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
