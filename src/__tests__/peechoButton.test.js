/**
 * Loading Peecho's print button script — utils/peechoButton.js.
 *
 * The script finds its buttons when it runs, and the app's button appears long
 * after page load; so it is loaded again for every button, and only one copy
 * is ever on the page.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { loadPeechoButtons, peechoScriptUrl } from '../utils/peechoButton'

const scripts = () => document.head.querySelectorAll('script#peecho-print-button-script')

afterEach(() => {
  for (const script of scripts()) script.remove()
})

describe('loadPeechoButtons', () => {
  it('loads the merchant’s own script', async () => {
    const loaded = loadPeechoButtons('13032875623450')
    const [script] = scripts()
    expect(script.src).toBe('https://d3aln0nj58oevo.cloudfront.net/button/script/13032875623450.js')
    expect(script.async).toBe(true)
    script.dispatchEvent(new Event('load'))
    await expect(loaded).resolves.toBeUndefined()
  })

  it('replaces the previous copy so the script runs again for a new button', () => {
    loadPeechoButtons('k1').catch(() => {})
    const first = scripts()[0]
    loadPeechoButtons('k1').catch(() => {})
    expect(scripts()).toHaveLength(1)
    expect(scripts()[0]).not.toBe(first)
  })

  it('rejects when the script cannot be loaded', async () => {
    const loaded = loadPeechoButtons('k1')
    scripts()[0].dispatchEvent(new Event('error'))
    await expect(loaded).rejects.toThrow(/failed to load/)
  })

  it('keeps the key inside the file name', () => {
    expect(peechoScriptUrl('a/../b')).toBe('https://d3aln0nj58oevo.cloudfront.net/button/script/a%2F..%2Fb.js')
  })
})
