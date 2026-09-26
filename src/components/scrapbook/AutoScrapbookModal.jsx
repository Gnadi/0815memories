import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, Sparkles, Check, CalendarDays, ListChecks, Star } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { useMemories, useAllMoments } from '../../hooks/useMemories'
import {
  collectEntries,
  suggestMonths,
  entriesInMonth,
  buildScrapbook,
  yearSpan,
  monthKey,
} from '../../utils/autoScrapbook'
import { devError } from '../../utils/devLog'

// Enough history for a year or two of month suggestions; the feed's default of
// 50 would leave older months looking empty.
const MEMORY_LIMIT = 300
const MOMENT_LIMIT = 300

function Thumb({ photo, className = '' }) {
  return (
    <div className={`overflow-hidden bg-cream-dark ${className}`}>
      {photo && (
        <EncryptedImage src={photo.url} thumbSrc={photo.thumbUrl || ''} alt="" className="w-full h-full object-cover" />
      )}
    </div>
  )
}

/**
 * "Create automatically" — offers ready-made books for the family's busiest
 * recent months, or builds one from memories and moments picked by hand.
 * `onCreate({ title, pages, coverImageUrl })` does the saving and navigation.
 */
export default function AutoScrapbookModal({ familyId, encryptionKey, onClose, onCreate }) {
  const { t, i18n } = useTranslation('scrapbook')
  const { memories, loading: memoriesLoading } = useMemories(familyId, encryptionKey, MEMORY_LIMIT)
  const { moments, loading: momentsLoading } = useAllMoments(familyId, encryptionKey, MOMENT_LIMIT)
  const loading = memoriesLoading || momentsLoading

  const [mode, setMode] = useState('month')
  const [monthId, setMonthId] = useState(null)
  const [customMonth, setCustomMonth] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [filter, setFilter] = useState('all')
  const [selectionTitle, setSelectionTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const entries = useMemo(() => collectEntries(memories, moments), [memories, moments])
  const suggestions = useMemo(() => suggestMonths(entries), [entries])
  const newestFirst = useMemo(() => [...entries].reverse(), [entries])

  const monthName = (year, month) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
  const monthOnly = (year, month) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(year, month, 1))
  const formatDate = (d) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)

  // The month the user is looking at: a picked suggestion, or the month input.
  const activeMonth = useMemo(() => {
    if (customMonth) {
      const [y, m] = customMonth.split('-').map(Number)
      return { year: y, month: m - 1 }
    }
    const s = suggestions.find((x) => x.id === monthId)
    return s ? { year: s.year, month: s.month } : null
  }, [customMonth, monthId, suggestions])

  const monthEntries = useMemo(
    () => (activeMonth ? entriesInMonth(entries, activeMonth.year, activeMonth.month) : []),
    [activeMonth, entries]
  )

  const pickedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected]
  )

  const visibleEntries = filter === 'all' ? newestFirst : newestFirst.filter((e) => e.kind === filter)

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const source = mode === 'month' ? monthEntries : pickedEntries
  const canCreate = source.length > 0 && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    setError(null)
    try {
      let title
      let subtitle
      if (mode === 'month') {
        title = monthName(activeMonth.year, activeMonth.month)
        subtitle = String(activeMonth.year)
      } else {
        title = selectionTitle.trim() || t('auto.selectionDefaultTitle')
        subtitle = yearSpan(pickedEntries)
      }
      const coverTitle = mode === 'month' ? monthOnly(activeMonth.year, activeMonth.month) : title
      const { pages, coverImageUrl } = buildScrapbook(source, { title: coverTitle, subtitle, formatDate })
      await onCreate({ title, pages, coverImageUrl })
    } catch (err) {
      devError('Failed to create automatic scrapbook:', err)
      setError(t('errors.createFailed'))
      setCreating(false)
    }
  }

  const tabClass = (active) =>
    `flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
      active ? 'bg-warm-white text-bark shadow-sm' : 'text-bark-muted hover:text-bark'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={creating ? undefined : onClose} />

      <div className="relative bg-warm-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 className="text-lg font-bold text-bark flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-kaydo" />
              {t('auto.title')}
            </h2>
            <p className="text-xs text-bark-muted mt-0.5">{t('auto.subtitle')}</p>
          </div>
          <button onClick={onClose} disabled={creating} className="text-bark-muted hover:text-bark" aria-label={t('auto.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-1 p-1 bg-cream rounded-2xl" role="tablist">
            <button role="tab" aria-selected={mode === 'month'} className={tabClass(mode === 'month')} onClick={() => setMode('month')}>
              <CalendarDays className="w-4 h-4" />
              {t('auto.byMonth')}
            </button>
            <button role="tab" aria-selected={mode === 'selection'} className={tabClass(mode === 'selection')} onClick={() => setMode('selection')}>
              <ListChecks className="w-4 h-4" />
              {t('auto.bySelection')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-kaydo" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-bark-muted text-center py-12">{t('auto.noPhotos')}</p>
          ) : mode === 'month' ? (
            <div className="space-y-4">
              {suggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-bark mb-2">{t('auto.suggestions')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.map((s) => {
                      const active = !customMonth && monthId === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setMonthId(s.id); setCustomMonth('') }}
                          className={`text-left rounded-2xl border-2 p-2 flex gap-3 items-center transition-colors ${
                            active ? 'border-kaydo bg-kaydo/5' : 'border-cream-dark hover:border-kaydo/50'
                          }`}
                        >
                          <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden">
                            <Thumb photo={s.preview[0]} className="row-span-2" />
                            <Thumb photo={s.preview[1]} />
                            <Thumb photo={s.preview[2]} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-bark truncate capitalize">{monthName(s.year, s.month)}</p>
                            <p className="text-xs text-bark-muted">
                              {t('auto.entryCount', { count: s.entryCount })} · {t('auto.photoCount', { count: s.photoCount })}
                            </p>
                            {s.busiest && (
                              <p className="text-xs text-kaydo flex items-center gap-1 mt-0.5">
                                <Star className="w-3 h-3" /> {t('auto.busiest')}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auto-month" className="block text-sm font-semibold text-bark mb-2">
                  {t('auto.otherMonth')}
                </label>
                <input
                  id="auto-month"
                  type="month"
                  value={customMonth}
                  onChange={(e) => { setCustomMonth(e.target.value); setMonthId(null) }}
                  max={monthKey(new Date())}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                />
              </div>

              {activeMonth && (
                <p className="text-sm text-bark-muted">
                  {monthEntries.length > 0
                    ? t('auto.monthSummary', {
                      entries: t('auto.entryCount', { count: monthEntries.length }),
                      photos: t('auto.photoCount', { count: monthEntries.reduce((n, e) => n + e.photos.length, 0) }),
                    })
                    : t('auto.monthEmpty')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="auto-title" className="block text-sm font-semibold text-bark mb-2">
                  {t('auto.bookTitle')}
                </label>
                <input
                  id="auto-title"
                  type="text"
                  value={selectionTitle}
                  onChange={(e) => setSelectionTitle(e.target.value)}
                  placeholder={t('auto.selectionDefaultTitle')}
                  maxLength={60}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'memory', 'moment'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filter === f ? 'bg-kaydo text-white border-kaydo' : 'border-cream-dark text-bark-muted hover:text-bark'
                    }`}
                  >
                    {t(`auto.filter.${f}`)}
                  </button>
                ))}
                <span className="ml-auto text-xs text-bark-muted">
                  {t('auto.selectedCount', { count: selected.size })}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {visibleEntries.map((e) => {
                  const isSelected = selected.has(e.id)
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggle(e.id)}
                      aria-pressed={isSelected}
                      className={`relative text-left rounded-xl overflow-hidden border-2 transition-colors ${
                        isSelected ? 'border-kaydo' : 'border-transparent'
                      }`}
                    >
                      <Thumb photo={e.photos[0]} className="aspect-square" />
                      <span
                        className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          isSelected ? 'bg-kaydo border-kaydo text-white' : 'bg-warm-white/80 border-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[10px]">
                        {t(`auto.kind.${e.kind}`)}{e.photos.length > 1 ? ` · ${e.photos.length}` : ''}
                      </span>
                      <div className="px-1.5 py-1 bg-warm-white">
                        <p className="text-xs text-bark truncate">{e.title || '—'}</p>
                        {e.date && <p className="text-[10px] text-bark-muted truncate">{formatDate(e.date)}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-cream-dark flex items-center gap-3">
          {error && <p className="text-sm text-red-700 flex-1">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="btn-kaydo flex items-center gap-2 text-sm ml-auto disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('auto.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
