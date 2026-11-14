import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RichTextEditorLazy from '../admin/RichTextEditorLazy'
import RichContent from '../memory/RichContent'
import DictationField from '../DictationField'
import { appendDictation } from '../../hooks/useDictation'
import { markdownToRich, richToMarkdown } from '../../utils/markdown'
import { richDocIsEmpty } from '../../utils/richText'

const TAB = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors'
const TAB_ACTIVE = 'bg-warm-white text-bark shadow-sm'
const TAB_IDLE = 'text-bark-muted hover:text-bark'

/**
 * A recipe's instructions, written in the rich editor or, for those who prefer
 * it, in Markdown. Which one is chosen per recipe.
 *
 * `value` is { format, rich, markdown }. Switching carries the text over, so
 * nobody loses a half-written recipe by trying the other editor: what is on
 * screen is converted, and the other side's older text is replaced by it.
 */
export default function RecipeInstructionsField({ value, onChange, disabled = false }) {
  const { t } = useTranslation('recipes')
  const [preview, setPreview] = useState(false)
  const { format, rich, markdown } = value

  const switchTo = (next) => {
    if (next === format) return
    if (next === 'markdown') {
      onChange({ format: next, rich, markdown: richDocIsEmpty(rich) ? '' : richToMarkdown(rich) })
    } else {
      onChange({ format: next, rich: markdown.trim() ? markdownToRich(markdown) : null, markdown })
    }
    setPreview(false)
  }

  const previewDoc = useMemo(() => (preview ? markdownToRich(markdown) : null), [preview, markdown])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide">
          {t('form.instructionsLabel')}
        </label>
        <div role="radiogroup" aria-label={t('form.instructionsFormat.label')} className="flex gap-1 p-1 rounded-xl bg-cream-dark/60">
          {['rich', 'markdown'].map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              disabled={disabled}
              onClick={() => switchTo(f)}
              title={t(`form.instructionsFormat.${f}Hint`)}
              className={`${TAB} ${format === f ? TAB_ACTIVE : TAB_IDLE}`}
            >
              {t(`form.instructionsFormat.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {format === 'markdown' ? (
        <div>
          <div className="flex gap-1 mb-2">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={preview === p}
                onClick={() => setPreview(p)}
                className={`${TAB} ${preview === p ? 'bg-cream-dark text-bark' : TAB_IDLE}`}
              >
                {p ? t('form.markdown.preview') : t('form.markdown.write')}
              </button>
            ))}
          </div>
          {preview ? (
            <div className="min-h-[148px] bg-cream rounded-xl px-4 py-3 border border-cream-dark">
              {markdown.trim()
                ? <RichContent doc={previewDoc} compact />
                : <p className="text-sm text-bark-muted">{t('form.markdown.previewEmpty')}</p>}
            </div>
          ) : (
            <DictationField
              disabled={disabled}
              onText={(s) => onChange({ ...value, markdown: appendDictation(markdown, s) })}
            >
              <textarea
                value={markdown}
                onChange={(e) => onChange({ ...value, markdown: e.target.value })}
                placeholder={t('form.markdown.placeholder')}
                disabled={disabled}
                rows={8}
                spellCheck
                className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm font-mono text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors resize-y pr-12"
              />
            </DictationField>
          )}
          <p className="text-xs text-bark-muted mt-1.5">{t('form.markdown.help')}</p>
        </div>
      ) : (
        <RichTextEditorLazy
          value={rich}
          onChange={(doc) => onChange({ ...value, rich: doc })}
          disabled={disabled}
          media={false}
          label={t('form.instructionsLabel')}
          placeholder={t('form.instructionsPlaceholder')}
        />
      )}
    </div>
  )
}
