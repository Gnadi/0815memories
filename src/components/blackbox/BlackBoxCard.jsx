import { useState } from 'react'
import { Lock, Unlock, Trash2, MoreVertical, Calendar, Star, BookOpen } from 'lucide-react'
import { isUnlocked } from '../../hooks/useBlackBox'

const MILESTONE_LABELS = {
  '18thBirthday': '18th Birthday',
  '21stBirthday': '21st Birthday',
  graduation: 'Graduation',
  wedding: 'Wedding Day',
  firstJob: 'First Job',
}

function formatUnlockDate(box) {
  if (box.triggerType === 'legacy') return 'Upon legacy trigger'
  if (!box.unlockDate) return 'Unknown date'
  const d = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getTriggerDescription(box) {
  if (box.triggerType === 'legacy') return 'Legacy Trigger — Release after my passing'
  if (box.triggerType === 'milestone') return `Life Milestone — ${MILESTONE_LABELS[box.milestone] || box.milestone}`
  if (box.triggerType === 'specificDate') return `Specific Date — ${formatUnlockDate(box)}`
  return ''
}

export default function BlackBoxCard({ box, kidName, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const unlocked = isUnlocked(box)

  const triggerDesc = getTriggerDescription(box)
  const unlockDateStr = formatUnlockDate(box)

  return (
    <div
      className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${
        unlocked
          ? 'bg-warm-white border-cream-dark'
          : 'bg-bark text-white border-bark'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        {/* Lock icon */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            unlocked ? 'bg-green-100' : 'bg-white/10'
          }`}
        >
          {unlocked ? (
            <Unlock className="w-6 h-6 text-green-700" />
          ) : (
            <Lock className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-base truncate ${unlocked ? 'text-bark' : 'text-white'}`}>
            {box.title || 'Untitled'}
          </h3>
          {kidName && (
            <p className={`text-xs mt-0.5 ${unlocked ? 'text-bark-muted' : 'text-white/60'}`}>
              For {kidName}
            </p>
          )}
          <p className={`text-xs mt-1 ${unlocked ? 'text-bark-muted' : 'text-white/70'}`}>
            {triggerDesc}
          </p>
        </div>

        {/* Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`p-1.5 rounded-lg ${unlocked ? 'text-bark-muted hover:text-bark' : 'text-white/60 hover:text-white'}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-cream-dark z-10 min-w-[140px] py-1">
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      {!unlocked ? (
        <div className="px-5 pb-4">
          <div className="bg-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-hearth flex-shrink-0" />
            <p className="text-xs text-white/80">
              Sealed until{' '}
              <span className="text-hearth font-semibold">{unlockDateStr}</span>.{' '}
              Your legacy is safe with us.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {/* Unlocked — show content toggle */}
          <div className="px-5 pb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
              <Unlock className="w-3 h-3" /> Unlocked
            </span>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left px-5 pb-4 text-sm text-hearth font-semibold hover:text-hearth/80"
          >
            {expanded ? 'Hide Contents ↑' : 'View Contents ↓'}
          </button>

          {expanded && (
            <div className="px-5 pb-5 border-t border-cream-dark pt-4 space-y-3">
              {box.message && (
                <p className="text-sm text-bark leading-relaxed whitespace-pre-wrap">{box.message}</p>
              )}
              {box.photos?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {box.photos.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" />
                  ))}
                </div>
              )}
              {box.voiceNote?.url && (
                <audio controls src={box.voiceNote.url} className="w-full mt-2" />
              )}
              {box.videos?.length > 0 && (
                <div className="space-y-2 mt-2">
                  {box.videos.map((v, i) => (
                    <video
                      key={v.publicId || i}
                      src={v.url}
                      controls
                      playsInline
                      className="w-full rounded-xl bg-black max-h-64"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
