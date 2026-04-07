export default function RecipeEvolutionTree({ versions, onVersionClick }) {
  if (!versions || versions.length === 0) return null

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-kaydo/20 rounded-full" />

      <div className="space-y-5">
        {versions.map((version, index) => {
          const isFirst = index === 0
          const isLast = index === versions.length - 1
          const isMiddle = !isFirst && !isLast

          let dotClass = 'bg-bark'
          if (isLast && versions.length > 1) dotClass = 'bg-kaydo'
          else if (isMiddle) dotClass = 'bg-kaydo/50'

          let badge = null
          if (isFirst) {
            badge = (
              <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 rounded-full px-2 py-0.5">
                Archive
              </span>
            )
          } else if (isLast) {
            badge = (
              <span className="text-[10px] font-semibold bg-kaydo text-white rounded-full px-2 py-0.5">
                CURRENT
              </span>
            )
          } else {
            badge = (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                MODIFIED
              </span>
            )
          }

          return (
            <div key={version.id} className="relative">
              {/* Dot on the line */}
              <div
                className={`absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${dotClass}`}
              />

              {/* Content card */}
              <button
                onClick={() => onVersionClick?.(version)}
                className="w-full text-left bg-warm-white rounded-2xl p-4 shadow-sm border border-transparent hover:border-kaydo/30 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-bark">
                    {version.year}: {isFirst ? 'Original' : version.author ? `${version.author}'s Fork` : 'Fork'}
                  </span>
                  {badge}
                </div>

                <p className="text-sm font-semibold text-bark">{version.title}</p>

                {/* Change chips */}
                {version.changes && version.changes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {version.changes.map((change, i) => {
                      let chipClass = 'bg-amber-100 text-amber-700'
                      if (change.type === 'REMOVED') chipClass = 'bg-red-100 text-red-600'
                      if (change.type === 'ADDED') chipClass = 'bg-green-100 text-green-700'
                      return (
                        <span
                          key={i}
                          className={`text-[10px] font-semibold rounded-md px-1.5 py-0.5 ${chipClass}`}
                        >
                          {change.type} {change.ingredient}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Description / fork reason snippet */}
                {(version.forkReason || version.description) && (
                  <p className="text-xs text-bark-muted mt-1.5 line-clamp-1">
                    {version.forkReason || version.description}
                  </p>
                )}

                <p className="text-xs text-kaydo font-semibold mt-2">View details →</p>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
