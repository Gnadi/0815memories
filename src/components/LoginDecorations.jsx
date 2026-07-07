// Floating-emoji decoration layer for themed login pages. Pure presentational
// markup — emojis come from the curated THEME_DECORATIONS list, never from
// free-form user input.
const SLOTS = [
  { left: '6%', delay: '0s', duration: '11s', size: '1.6rem' },
  { left: '18%', delay: '2.5s', duration: '14s', size: '1.1rem' },
  { left: '31%', delay: '5s', duration: '12s', size: '1.9rem' },
  { left: '44%', delay: '1s', duration: '15s', size: '1.2rem' },
  { left: '57%', delay: '6s', duration: '11.5s', size: '1.7rem' },
  { left: '69%', delay: '3.5s', duration: '13s', size: '1.3rem' },
  { left: '81%', delay: '0.5s', duration: '14.5s', size: '1.8rem' },
  { left: '92%', delay: '4.5s', duration: '12.5s', size: '1.2rem' },
]

export default function LoginDecorations({ emojis }) {
  if (!emojis || emojis.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* The float is container-relative (animated `bottom` in %), so the
          emojis traverse the whole layer no matter how tall it is — the same
          on the real login page and inside the designer's preview box.
          vh-based transforms would only cover the bottom viewport-height of
          a taller page and never reach the visible screen. */}
      <style>{`
        @keyframes login-deco-float {
          0% { bottom: -8%; transform: rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { bottom: 108%; transform: rotate(25deg); opacity: 0; }
        }
      `}</style>
      {SLOTS.map((slot, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: slot.left,
            bottom: '-8%',
            fontSize: slot.size,
            animation: `login-deco-float ${slot.duration} linear infinite`,
            animationDelay: slot.delay,
            opacity: 0,
          }}
        >
          {emojis[i % emojis.length]}
        </span>
      ))}
    </div>
  )
}
