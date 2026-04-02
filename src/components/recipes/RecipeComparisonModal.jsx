import { useState } from 'react'
import { X, ChefHat, GitFork, Copy, Share2 } from 'lucide-react'

function computeDiffTags(versA, versB) {
  // Map A ingredients by normalized name for O(1) lookup and full-text comparison
  const aMap = new Map((versA.ingredients || []).map((i) => [i.name.toLowerCase(), i]))
  const bNames = new Set((versB.ingredients || []).map((i) => i.name.toLowerCase()))

  const enrichedA = (versA.ingredients || []).map((i) => ({
    ...i,
    diffTag: bNames.has(i.name.toLowerCase()) ? 'UNCHANGED' : 'REMOVED',
  }))

  const enrichedB = (versB.ingredients || []).map((i) => {
    const normName = i.name.toLowerCase()
    if (aMap.has(normName)) {
      const aIng = aMap.get(normName)
      // MODIFIED if author annotated it OR if the full ingredient text differs (e.g. quantity changed)
      const isModified = i.status === 'modified' || aIng.name !== i.name
      return { ...i, diffTag: isModified ? 'MODIFIED' : 'UNCHANGED' }
    }
    return { ...i, diffTag: 'ADDED' }
  })

  return { enrichedA, enrichedB }
}

function IngredientRow({ ing }) {
  const tagStyles = {
    UNCHANGED: { pill: 'bg-stone-100 text-stone-500', text: 'text-bark-muted' },
    REMOVED: { pill: 'bg-red-100 text-red-600', text: 'text-bark-muted line-through' },
    MODIFIED: { pill: 'bg-amber-100 text-amber-700', text: 'text-bark' },
    ADDED: { pill: 'bg-green-100 text-green-700', text: 'text-bark' },
  }
  const style = tagStyles[ing.diffTag] || tagStyles.UNCHANGED
  const showTag = ing.diffTag !== 'UNCHANGED'

  return (
    <div className="flex items-center justify-between py-2 border-b border-cream-dark last:border-0">
      <span className={`text-sm ${style.text}`}>{ing.name}</span>
      {showTag && (
        <span className={`text-[10px] font-bold uppercase rounded-md px-1.5 py-0.5 ml-2 shrink-0 ${style.pill}`}>
          {ing.diffTag}
        </span>
      )}
      {!showTag && (
        <span className="text-[10px] text-stone-400 ml-2 shrink-0">UNCHANGED</span>
      )}
    </div>
  )
}

export default function RecipeComparisonModal({ versionA, versionB, allVersions, onClose }) {
  const [localA, setLocalA] = useState(versionA)
  const [localB, setLocalB] = useState(versionB)
  const [copied, setCopied] = useState(false)

  const { enrichedA, enrichedB } = computeDiffTags(localA, localB)

  const addedCount = enrichedB.filter((i) => i.diffTag === 'ADDED').length
  const removedCount = enrichedB.filter((i) => i.diffTag === 'REMOVED' || enrichedA.find(a => a.diffTag === 'REMOVED' && a.name.toLowerCase() === i.name.toLowerCase())).length
  const modifiedCount = enrichedB.filter((i) => i.diffTag === 'MODIFIED').length
  const actualRemovedCount = enrichedA.filter((i) => i.diffTag === 'REMOVED').length

  const handleShare = async () => {
    const text = `${localB.title} (${localB.year}) — forked from ${localA.title} (${localA.year})\n\nReason: ${localB.forkReason || 'No reason given'}`
    try {
      if (navigator.share) {
        await navigator.share({ title: localB.title, text, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Dismissed share dialog — no action needed
    }
  }

  const handleMergeNotes = async () => {
    const notes = [
      `Fork: ${localB.title} (${localB.year})`,
      `Author: ${localB.author}`,
      localB.forkReason ? `Reason: ${localB.forkReason}` : '',
      ...(localB.changes || []).map((c) => `${c.type}: ${c.ingredient} — ${c.description}`),
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(notes)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="min-h-full flex items-start justify-center p-4 py-8">
        <div className="w-full max-w-5xl bg-cream rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-cream-dark">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-hearth mb-1">
                Recipe Fork
              </p>
              <h2 className="text-2xl font-bold text-bark">Comparison View</h2>
              <p className="text-sm text-bark-muted mt-1">
                Tracing the culinary journey across {Math.abs((localB.year || 0) - (localA.year || 0))} years of taste and tradition.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-bark/10 flex items-center justify-center text-bark hover:bg-bark/20 transition-colors shrink-0 ml-4"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Version selectors */}
          {allVersions.length > 2 && (
            <div className="flex items-center gap-3 px-5 py-3 bg-warm-white border-b border-cream-dark text-sm">
              <select
                value={localA.id}
                onChange={(e) => {
                  const v = allVersions.find((v) => v.id === e.target.value)
                  if (v) setLocalA(v)
                }}
                className="bg-cream rounded-xl px-3 py-1.5 text-sm text-bark border border-cream-dark focus:outline-none focus:border-hearth"
              >
                {allVersions.map((v) => (
                  <option key={v.id} value={v.id}>{v.year}: {v.title}</option>
                ))}
              </select>
              <span className="text-bark-muted font-bold">vs</span>
              <select
                value={localB.id}
                onChange={(e) => {
                  const v = allVersions.find((v) => v.id === e.target.value)
                  if (v) setLocalB(v)
                }}
                className="bg-cream rounded-xl px-3 py-1.5 text-sm text-bark border border-cream-dark focus:outline-none focus:border-hearth"
              >
                {allVersions.map((v) => (
                  <option key={v.id} value={v.id}>{v.year}: {v.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Main comparison grid */}
          <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_220px_1fr] gap-5">

            {/* Left: Version A */}
            <div className="bg-warm-white rounded-2xl overflow-hidden shadow-sm">
              {localA.image ? (
                <img src={localA.image} alt={localA.title} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
                  <ChefHat className="w-10 h-10 text-stone-300" />
                </div>
              )}
              <div className="p-4">
                <div className="inline-block text-[10px] font-bold uppercase tracking-wider bg-stone-200 text-stone-600 rounded-full px-2 py-0.5 mb-2">
                  Original Branch
                </div>
                <h3 className="text-lg font-bold text-bark leading-tight">{localA.title}</h3>
                <p className="text-xs text-bark-muted mt-0.5">{localA.year} · {localA.author}</p>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-bark flex items-center gap-1.5 mb-2">
                    <span>🍴</span> Core Ingredients
                  </p>
                  <div>
                    {enrichedA.map((ing, i) => (
                      <IngredientRow key={i} ing={ing} />
                    ))}
                    {enrichedA.length === 0 && (
                      <p className="text-xs text-bark-muted">No ingredients listed.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle: Evolutionary Shift */}
            <div className="bg-bark rounded-2xl p-5 text-white flex flex-col gap-4 shadow-sm">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                  Evolutionary Shift
                </p>
                <div className="flex justify-center gap-3 flex-wrap mt-2">
                  {addedCount > 0 && (
                    <span className="text-xs font-semibold bg-green-500/20 text-green-300 rounded-full px-2.5 py-1">
                      +{addedCount} Added
                    </span>
                  )}
                  {actualRemovedCount > 0 && (
                    <span className="text-xs font-semibold bg-red-500/20 text-red-300 rounded-full px-2.5 py-1">
                      −{actualRemovedCount} Removed
                    </span>
                  )}
                  {modifiedCount > 0 && (
                    <span className="text-xs font-semibold bg-amber-500/20 text-amber-300 rounded-full px-2.5 py-1">
                      ~{modifiedCount} Modified
                    </span>
                  )}
                  {addedCount === 0 && actualRemovedCount === 0 && modifiedCount === 0 && (
                    <span className="text-xs text-white/40">No ingredient changes</span>
                  )}
                </div>
              </div>

              {/* Fork reason */}
              {localB.forkReason && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                    Reason for the Fork
                  </p>
                  <p className="text-sm italic text-white/80 leading-relaxed">
                    "{localB.forkReason}"
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    — {localB.author}, {localB.year}
                  </p>
                </div>
              )}

              {/* Chef's secret tip */}
              {localB.chefNote && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                    Chef's Secret Tip
                  </p>
                  <p className="text-sm text-white/70 italic leading-relaxed">
                    "{localB.chefNote}"
                  </p>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2">
                <button
                  onClick={handleMergeNotes}
                  className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Merge Notes to History'}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 w-full bg-hearth hover:bg-hearth-light text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Fork
                </button>
              </div>
            </div>

            {/* Right: Version B */}
            <div className="bg-warm-white rounded-2xl overflow-hidden shadow-sm">
              {localB.image ? (
                <img src={localB.image} alt={localB.title} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                  <ChefHat className="w-10 h-10 text-green-200" />
                </div>
              )}
              <div className="p-4">
                <div className="inline-block text-[10px] font-bold uppercase tracking-wider bg-hearth text-white rounded-full px-2 py-0.5 mb-2">
                  {localB.year} Fork
                </div>
                <h3 className="text-lg font-bold text-bark leading-tight">{localB.title}</h3>
                <p className="text-xs text-bark-muted mt-0.5">{localB.year} · {localB.author}</p>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-bark flex items-center gap-1.5 mb-2">
                    <span>🌿</span> New Substitutions
                  </p>
                  <div>
                    {enrichedB.map((ing, i) => (
                      <IngredientRow key={i} ing={ing} />
                    ))}
                    {enrichedB.length === 0 && (
                      <p className="text-xs text-bark-muted">No ingredients listed.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <div className="px-5 pb-5 text-center">
            <p className="text-xs text-bark-muted flex items-center justify-center gap-1.5">
              <GitFork className="w-3 h-3" />
              {allVersions.length} generation{allVersions.length !== 1 ? 's' : ''} of shared history
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
