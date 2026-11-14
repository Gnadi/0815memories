import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseIngredientList } from '../../utils/ingredientList'

/**
 * A box to paste a whole ingredient list or table into. What it will add is
 * shown before it is added, so a stray header or note can be fixed first.
 */
export default function IngredientPastePanel({ onAdd, onClose }) {
  const { t } = useTranslation('recipes')
  const [text, setText] = useState('')
  const items = useMemo(() => parseIngredientList(text), [text])

  const add = () => {
    if (!items.length) return
    onAdd(items)
    onClose()
  }

  return (
    <div className="rounded-xl border border-cream-dark bg-cream/60 p-3 space-y-2">
      <label htmlFor="ingredient-paste" className="text-xs font-semibold text-bark-muted uppercase tracking-wide block">
        {t('form.paste.label')}
      </label>
      <textarea
        id="ingredient-paste"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('form.paste.placeholder')}
        rows={6}
        autoFocus
        className="w-full bg-warm-white rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors resize-y"
      />
      <p className="text-xs text-bark-muted">{t('form.paste.help')}</p>

      {items.length > 0 && (
        <ul aria-label={t('form.paste.previewLabel')} className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="px-2 py-0.5 rounded-lg bg-warm-white border border-cream-dark text-xs text-bark">
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={add}
          disabled={!items.length}
          className="btn-kaydo px-4 py-2 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('form.paste.add', { count: items.length })}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-bark-muted hover:text-bark transition-colors">
          {t('common:buttons.cancel')}
        </button>
      </div>
    </div>
  )
}
