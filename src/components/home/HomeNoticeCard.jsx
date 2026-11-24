import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import './homeNotice.css'

/**
 * A notice on the home page: an icon tile, a small eyebrow, a title and a
 * line of text on a coloured background, leading somewhere on a tap.
 *
 * The whole card is the link, through the round arrow's link stretched over
 * it, so a dismiss button can sit on the card without nesting a button in a
 * link. The link's name is `cta`, which only screen readers hear.
 *
 * @param {object} props
 * @param {string} [props.to] Where a tap leads.
 * @param {() => void} [props.onClick] What a tap does instead, for a notice
 *   that opens a dialog rather than a page.
 * @param {string} props.title
 * @param {string} [props.eyebrow]
 * @param {string} [props.body]
 * @param {string} props.cta What following the link does, for screen readers.
 * @param {import('react').ReactNode} props.icon Shown on a white tile.
 * @param {'advent'|'kaydo'|'forest'|'night'} [props.background] Colours in homeNotice.css.
 * @param {string} [props.image] A picture behind the text, over the background.
 * @param {() => void} [props.onDismiss] Adds a button that hides the notice.
 * @param {string} [props.dismissLabel] That button's text.
 */
export default function HomeNoticeCard({
  to, onClick, title, eyebrow, body, cta, icon,
  background = 'kaydo', image, onDismiss, dismissLabel,
}) {
  const titleId = useId()
  const action = {
    className: "w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-white",
    children: (
      <>
        <ChevronRight className="w-5 h-5 text-white" aria-hidden="true" />
        <span className="sr-only">{cta}</span>
      </>
    ),
  }

  return (
    <section
      aria-labelledby={titleId}
      className={`relative mb-6 rounded-2xl overflow-hidden group shadow-md home-notice--${background}`}
    >
      {image && (
        <>
          <img src={image} alt="" loading="lazy" className="home-notice__image" />
          <div className="home-notice__shade" />
        </>
      )}
      <div className="relative flex items-center gap-4 px-5 py-5">
        <div className="w-12 h-12 rounded-xl bg-warm-white flex items-center justify-center flex-shrink-0 shadow">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-xs font-semibold tracking-widest text-white/75 uppercase mb-1">{eyebrow}</p>
          )}
          <h2 id={titleId} className="font-serif text-lg font-bold text-white leading-snug">{title}</h2>
          {body && <p className="text-sm text-white/80 mt-0.5">{body}</p>}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="relative z-10 mt-2 text-sm font-medium text-white/75 underline-offset-2 hover:text-white hover:underline transition-colors"
            >
              {dismissLabel}
            </button>
          )}
        </div>
        {onClick
          ? <button type="button" onClick={onClick} {...action} />
          : <Link to={to} {...action} />}
      </div>
    </section>
  )
}
