import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { defaultQuizQuestions, emptyKeepsakes, suggestChapterPeriod, suggestChapterTitle } from '../../utils/ourYear'

const toInputValue = (date) => {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const fromInputValue = (value) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Starting a new chapter. Title and period come pre-filled from the couple's
 * rhythm, but both are only suggestions — a chapter can cover whatever stretch
 * of time the two of them want to look back on.
 */
export default function NewChapterModal({ ritual, chapters, onClose, onCreate }) {
  const { t } = useTranslation('ourYear')

  const [suggestion] = useState(() => suggestChapterPeriod(ritual, chapters))
  const [title, setTitle] = useState(() => {
    const auto = suggestChapterTitle(suggestion.start, suggestion.end, chapters.length)
    return t(auto.key, auto.values)
  })
  const [start, setStart] = useState(() => toInputValue(suggestion.start))
  const [end, setEnd] = useState(() => toInputValue(suggestion.end))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError(t('errors.titleRequired'))
      return
    }
    const periodStart = fromInputValue(start)
    const periodEnd = fromInputValue(end)
    if (!(periodEnd > periodStart)) {
      setError(t('errors.periodInvalid'))
      return
    }

    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        titleIsAuto: false,
        periodStart,
        periodEnd,
        quizQuestions: defaultQuizQuestions(),
        quizReactions: {},
        keepsakes: emptyKeepsakes(),
      })
    } catch {
      setError(t('errors.saveFailed'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-warm-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-warm-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-bark">{t('chapter.newTitle')}</h2>
          <button type="button" onClick={onClose} className="text-bark-muted hover:text-bark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-bark-muted">{t('chapter.newSubtitle')}</p>

          <div>
            <label htmlFor="ouryear-title" className="block text-sm font-medium text-bark mb-1">
              {t('chapter.titleLabel')}
            </label>
            <input
              id="ouryear-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('chapter.titlePlaceholder')}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
            />
            <p className="text-xs text-bark-muted mt-1.5">{t('chapter.titleHint')}</p>
          </div>

          <div>
            <span className="block text-sm font-medium text-bark mb-1">{t('chapter.periodLabel')}</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-bark-muted mb-1">{t('chapter.from')}</span>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-bark-muted mb-1">{t('chapter.to')}</span>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
                />
              </label>
            </div>
            <p className="text-xs text-bark-muted mt-1.5">{t('chapter.periodHint')}</p>
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? t('chapter.creating') : t('chapter.create')}
          </button>
        </form>
      </div>
    </div>
  )
}
