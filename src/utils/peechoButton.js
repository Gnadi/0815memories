/**
 * Peecho's print button script.
 *
 * Peecho gives every merchant a script of their own (the button key is its
 * file name) that finds the `a.peecho-print-button` links on a page and turns
 * each into a way into Peecho's checkout. It looks for them when it runs, and
 * a single-page app puts its button on the page long after any first run — so
 * the script is loaded afresh whenever a button appears. A script element
 * executes once per insertion, which is what makes the second order in the
 * same session work too.
 */

const SCRIPT_ID = 'peecho-print-button-script'

export function peechoScriptUrl(buttonKey) {
  return `https://d3aln0nj58oevo.cloudfront.net/button/script/${encodeURIComponent(buttonKey)}.js`
}

/**
 * (Re)load the button script. Rejects when it cannot be loaded — most often a
 * content blocker, which the order dialog then says.
 */
export function loadPeechoButtons(buttonKey, doc = document) {
  doc.getElementById(SCRIPT_ID)?.remove()
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = peechoScriptUrl(buttonKey)
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Peecho print button script failed to load'))
    doc.head.appendChild(script)
  })
}
