import { useEffect, useRef } from 'react'
import { loadPeechoButtons } from '../../utils/peechoButton'

/**
 * A Peecho print button: the link Peecho's script turns into its checkout.
 *
 * The link is made by hand inside an element React leaves empty, rather than
 * rendered as JSX. Peecho's script restyles the link and may replace it, and a
 * node React owns that someone else has moved or removed makes React throw
 * when it next updates or unmounts.
 *
 * `attributes` are the link's data-* attributes (printButtonAttributes); keep
 * the object stable, since a new one rebuilds the button and reloads the script.
 */
export default function PeechoPrintButton({ buttonKey, attributes, label, onUnavailable }) {
  const hostRef = useRef(null)
  const onUnavailableRef = useRef(onUnavailable)
  useEffect(() => { onUnavailableRef.current = onUnavailable })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const link = document.createElement('a')
    link.className = 'peecho-print-button'
    link.href = 'https://www.peecho.com/'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = label
    for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value)
    host.replaceChildren(link)

    let active = true
    loadPeechoButtons(buttonKey).catch(() => {
      if (active) onUnavailableRef.current?.()
    })
    return () => {
      active = false
      host.replaceChildren()
    }
  }, [buttonKey, attributes, label])

  return <div ref={hostRef} className="peecho-button-host flex justify-center" data-testid="peecho-print-button" />
}
