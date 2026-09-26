import { useEffect, useRef } from 'react'
import { loadPeechoButtons } from '../../utils/peechoButton'

/**
 * A Peecho print button: the link Peecho's script turns into its checkout.
 *
 * What the script does with it (read from the script itself):
 *  - it finds `a.peecho-print-button` links, and refuses any whose href is not
 *    exactly https://www.peecho.com/
 *  - it matches the file's page count and aspect ratio against the merchant's
 *    products; with an empty link text it writes its own label, `data-text`
 *    plus the lowest price, or "unavailable" and a disabled class when no
 *    product fits. Any other link text it leaves alone — and then sends to
 *    checkout even when nothing fits — so the text stays empty here.
 *  - on click it POSTs the order request as a form to
 *    secure.print.peecho.com, which vercel.json's form-action has to allow.
 *    `data-new-window` sends it to a new tab, so the editor stays open.
 *  - `data-style="false"` keeps its green stylesheet out; index.css styles the
 *    button like the app's own.
 *
 * The link is made by hand inside an element React leaves empty, rather than
 * rendered as JSX: the script rewrites the link's content, and a node React
 * owns that someone else has changed makes React throw when it next updates.
 *
 * `attributes` are the link's data-* attributes (printButtonAttributes); keep
 * the object stable, since a new one rebuilds the button and reloads the script.
 * `onStatus` hears 'failed' when the script cannot be loaded and 'noProduct'
 * when the merchant has no product for this book.
 */
export default function PeechoPrintButton({ buttonKey, attributes, label, onStatus }) {
  const hostRef = useRef(null)
  const onStatusRef = useRef(onStatus)
  useEffect(() => { onStatusRef.current = onStatus })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const link = document.createElement('a')
    link.className = 'peecho-print-button'
    link.setAttribute('href', 'https://www.peecho.com/')
    for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value)
    link.setAttribute('data-text', label)
    link.setAttribute('data-style', 'false')
    link.setAttribute('data-new-window', 'true')
    // The script opens the checkout on mouseup only, which leaves keyboard
    // users stuck; Enter goes the same way.
    link.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !link.classList.contains('peecho-btn-okay')) return
      event.preventDefault()
      window.peecho?.send?.(link)
    })
    host.replaceChildren(link)

    let active = true
    loadPeechoButtons(buttonKey).then(
      () => {
        if (!active) return
        if (link.classList.contains('peecho-btn-disabled') || link.classList.contains('peecho-btn-error')) {
          onStatusRef.current?.('noProduct')
        }
      },
      () => {
        if (active) onStatusRef.current?.('failed')
      },
    )
    return () => {
      active = false
      host.replaceChildren()
    }
  }, [buttonKey, attributes, label])

  return <div ref={hostRef} className="peecho-button-host flex justify-center" data-testid="peecho-print-button" />
}
