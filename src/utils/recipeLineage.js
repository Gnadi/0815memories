/**
 * The versions of one family recipe as a tree, root first.
 *
 * Every version carries its `parentId`, so a recipe forked twice from the
 * original grows two branches instead of one list. A version whose parent is
 * gone (forks are not deleted with the fork they came from) hangs off the
 * root rather than vanishing from the tree. Siblings are ordered by year.
 */
export function buildLineageTree(versions) {
  if (!versions || versions.length === 0) return null

  const root = versions.find((v) => !v.parentId) ?? versions[0]
  const nodes = new Map(versions.map((v) => [v.id, { version: v, parent: null, children: [] }]))
  const rootNode = nodes.get(root.id)

  for (const version of versions) {
    if (version.id === root.id) continue
    const node = nodes.get(version.id)
    const parentNode = version.parentId !== version.id ? nodes.get(version.parentId) : null
    node.parent = (parentNode ?? rootNode).version
    ;(parentNode ?? rootNode).children.push(node)
  }

  for (const node of nodes.values()) {
    node.children.sort((a, b) => (a.version.year || 0) - (b.version.year || 0))
  }
  return rootNode
}

/** The newest version, the one a new fork would start from. */
export function newestVersion(versions) {
  return versions.reduce((newest, v) => ((v.year || 0) >= (newest.year || 0) ? v : newest), versions[0])
}
