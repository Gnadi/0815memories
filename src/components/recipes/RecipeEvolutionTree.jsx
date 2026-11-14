import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { buildLineageTree, newestVersion } from '../../utils/recipeLineage'

// Past this depth the phone layout stops indenting: on a 360px screen every
// further level would take another slice of the card's width.
const MAX_INDENT = 3

function VersionCard({ version, kind, parent, onVersionClick }) {
  const { t } = useTranslation('recipes')

  const badge = {
    original: ['bg-stone-200 text-stone-600', t('tree.archive')],
    current: ['bg-kaydo text-white', t('tree.current')],
    modified: ['bg-amber-100 text-amber-700', t('tree.modified')],
  }[kind]

  const label = kind === 'original'
    ? t('tree.original')
    : version.author
    ? t('tree.authorFork', { author: version.author })
    : t('tree.fork')

  return (
    <button
      onClick={() => onVersionClick?.(version)}
      className="w-full text-left bg-warm-white rounded-2xl p-4 shadow-sm border border-transparent hover:border-kaydo/30 hover:shadow-md transition-all"
    >
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1.5">
        <span className="text-sm font-bold text-bark">
          {t('tree.rowTitle', { year: version.year, label })}
        </span>
        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${badge[0]}`}>{badge[1]}</span>
      </div>

      <p className="text-sm font-semibold text-bark">{version.title}</p>

      {parent && (
        <p className="text-xs text-bark-muted mt-0.5">
          {t('tree.forkedFrom', { name: parent.author || parent.title })}
        </p>
      )}

      {version.changes && version.changes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {version.changes.map((change, i) => {
            let chipClass = 'bg-amber-100 text-amber-700'
            if (change.type === 'REMOVED') chipClass = 'bg-red-100 text-red-600'
            if (change.type === 'ADDED') chipClass = 'bg-green-100 text-green-700'
            return (
              <span key={i} className={`text-[10px] font-semibold rounded-md px-1.5 py-0.5 ${chipClass}`}>
                {t('compare.diff.' + change.type.toLowerCase(), change.type)} {change.ingredient}
              </span>
            )
          })}
        </div>
      )}

      {(version.forkReason || version.description) && (
        <p className="text-xs text-bark-muted mt-1.5 line-clamp-1">
          {version.forkReason || version.description}
        </p>
      )}

      <p className="text-xs text-kaydo font-semibold mt-2">{t('tree.viewDetails')}</p>
    </button>
  )
}

/* Wide screens: the family tree runs left to right, one column per
   generation, so time reads in the same direction as the text. */
function WideNode({ node, kindOf, onVersionClick }) {
  const { children } = node
  return (
    <div className="flex items-center">
      <div className="w-64 shrink-0">
        <VersionCard version={node.version} kind={kindOf(node.version)} onVersionClick={onVersionClick} />
      </div>
      {children.length > 0 && (
        <>
          <div className="w-8 h-px bg-kaydo/30 shrink-0" />
          <div className="flex flex-col">
            {children.map((child, i) => (
              <div key={child.version.id} className="relative flex items-center pl-8 py-2">
                <div className="absolute left-0 top-1/2 w-8 h-px bg-kaydo/30" />
                {children.length > 1 && (
                  <div
                    className={`absolute left-0 w-px bg-kaydo/30 ${i === 0 ? 'top-1/2' : 'top-0'} ${
                      i === children.length - 1 ? 'bottom-1/2' : 'bottom-0'
                    }`}
                  />
                )}
                <WideNode node={child} kindOf={kindOf} onVersionClick={onVersionClick} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* Phones: an indented outline. Each branch hangs off a guide line below its
   parent, which keeps the cards full-width instead of shrinking them. */
function NarrowNode({ node, depth, kindOf, onVersionClick }) {
  const { children } = node
  const indented = depth < MAX_INDENT
  return (
    <li className="relative">
      {depth > 0 && depth <= MAX_INDENT && <div className="absolute -left-3 top-7 w-3 h-px bg-kaydo/30" />}
      <VersionCard
        version={node.version}
        kind={kindOf(node.version)}
        parent={depth > MAX_INDENT ? node.parent : null}
        onVersionClick={onVersionClick}
      />
      {children.length > 0 && (
        <ul
          className={`mt-3 space-y-3 ${indented ? 'ml-3 pl-3 border-l-2 border-kaydo/20' : ''}`}
        >
          {children.map((child) => (
            <NarrowNode
              key={child.version.id}
              node={child}
              depth={depth + 1}
              kindOf={kindOf}
              onVersionClick={onVersionClick}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function RecipeEvolutionTree({ versions, onVersionClick }) {
  const tree = useMemo(() => buildLineageTree(versions), [versions])
  if (!tree) return null

  const newest = newestVersion(versions)
  const kindOf = (version) => {
    if (version.id === tree.version.id) return 'original'
    return version.id === newest.id ? 'current' : 'modified'
  }

  return (
    <>
      <div className="hidden xl:block overflow-x-auto pb-2">
        <WideNode node={tree} kindOf={kindOf} onVersionClick={onVersionClick} />
      </div>
      <ul className="xl:hidden">
        <NarrowNode node={tree} depth={0} kindOf={kindOf} onVersionClick={onVersionClick} />
      </ul>
    </>
  )
}
