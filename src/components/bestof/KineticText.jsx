/**
 * Words that move as they arrive, the way a recap video sets its type: word
 * by word, letter by letter, out from behind a mask, popping up, or written
 * out from left to right. The look says which (bestOfLooks.js, `text`); the
 * motion itself is CSS (bestOf.css), so holding the story holds it too.
 *
 * The text is there once more as it is, for screen readers and for finding it
 * on the page; the pieces that move are hidden from them (and marked
 * `data-kinetic`), or a reader would spell out a caption a letter at a time.
 */

// However long a line, it has arrived within this long.
const MAX_STAGGER_S = 1.1

const STEP_S = {
  words: 0.09,
  mask: 0.08,
  letters: 0.035,
  pop: 0.03,
}

export default function KineticText({ text, look, mode, delay = 0, as: Tag = 'p', className = '', style }) {
  if (!text) return null
  const how = mode || look?.text || 'words'
  return (
    <Tag className={className} style={style}>
      <span className="sr-only">{text}</span>
      <Moving text={String(text)} how={how} delay={delay} />
    </Tag>
  )
}

function Moving({ text, how, delay }) {
  if (how === 'write') {
    // Written out: the line uncovered from left to right, at a pace that
    // reads as a hand rather than a wipe.
    const seconds = Math.min(1.8, 0.35 + text.length * 0.035)
    return (
      <span aria-hidden="true" data-kinetic="" className="bestof-kt-write inline-block" style={{ animationDelay: `${delay}s`, animationDuration: `${seconds}s` }}>
        {text}
      </span>
    )
  }

  const words = text.split(/\s+/).filter(Boolean)
  const letters = how === 'letters' || how === 'pop'
  const pieces = letters ? text.replace(/\s+/g, '').length : words.length
  const step = Math.min(STEP_S[how] ?? STEP_S.words, MAX_STAGGER_S / Math.max(1, pieces))
  let n = 0
  const at = () => ({ animationDelay: `${(delay + step * n++).toFixed(3)}s` })

  return (
    <span aria-hidden="true" data-kinetic="">
      {words.map((word, w) => (
        <span key={w}>
          {w > 0 && ' '}
          {letters
            // A word's letters stay together, so a line never breaks inside it.
            ? (
              <span className="inline-block whitespace-nowrap">
                {[...word].map((letter, l) => (
                  <span key={l} className={`inline-block bestof-kt-${how}`} style={at()}>{letter}</span>
                ))}
              </span>
            )
            : how === 'mask'
              ? (
                <span className="inline-block overflow-hidden align-bottom pb-[0.08em]">
                  <span className="inline-block bestof-kt-mask" style={at()}>{word}</span>
                </span>
              )
              : <span className="inline-block bestof-kt-words" style={at()}>{word}</span>}
        </span>
      ))}
    </span>
  )
}

/**
 * A number rolling into place digit by digit, like a counter's wheels, the
 * last digit turning longest. Commas and points stay where they are.
 */
export function RollingNumber({ value, locale, delay = 0, className = '' }) {
  const text = Number(value || 0).toLocaleString(locale)
  const digits = [...text]
  return (
    <span className={`inline-flex ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-kinetic="" className="inline-flex" data-testid="bestof-rolling">
        {digits.map((char, i) => (
          /\d/.test(char)
            ? (
              <span key={i} className="relative inline-block h-[1em] overflow-hidden leading-none">
                <span
                  className="bestof-roll flex flex-col"
                  style={{
                    '--bestof-roll-to': `-${10 + Number(char)}em`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${1.1 + (i / digits.length) * 0.6}s`,
                  }}
                >
                  {Array.from({ length: 20 }, (_, k) => (
                    <span key={k} className="block h-[1em] leading-none">{k % 10}</span>
                  ))}
                </span>
              </span>
            )
            : <span key={i} className="leading-none">{char}</span>
        ))}
      </span>
    </span>
  )
}
