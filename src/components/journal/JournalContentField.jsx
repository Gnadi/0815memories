import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RichTextEditorLazy from '../admin/RichTextEditorLazy'
import RichContent from '../memory/RichContent'
import DictationField from '../DictationField'
import { appendDictation } from '../../hooks/useDictation'
import { markdownToRich, richToMarkdown } from '../../utils/markdown'
import { richDocIsEmpty } from '../../utils/richText'

const TAB = 'min-h-9 px-3 rounded-lg text-xs font-semibold transition-colors'
const TAB_ACTIVE = 'bg-warm-white text-bark shadow-sm'
const TAB_IDLE = 'text-bark-muted hover:text-bark'

/**
 * An entry's text, written in the rich editor or in Markdown, as a recipe's
 * instructions are (RecipeInstructionsField). The editor leaves its media out:
 * an entry keeps its photos, videos and voice notes as attachments, as every
 * entry from before the editor does.
 *
 * `value` is { format, rich, markdown }. Switching carries the text over, so a
 * half-written letter survives trying the other editor.
 */
export default function JournalContentField({ value, onChange, placeholder, disabled = false }) {
  const { t } = useTranslation('journal')
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
        <span className="text-xs font-semibold text-bark-muted uppercase tracking-wide">
          {t('editor.contentLabel')}
        </span>
        <div role="radiogroup" aria-label={t('editor.format.label')} className="flex gap-1 p-1 rounded-xl bg-cream-dark/60">
          {['rich', 'markdown'].map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              disabled={disabled}
              onClick={() => switchTo(f)}
              title={t(`editor.format.${f}Hint`)}
              className={`${TAB} ${format === f ? TAB_ACTIVE : TAB_IDLE}`}
            >
              {t(`editor.format.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {format === 'markdown' ? (
        <div className="rounded-xl bg-cream-dark/60 border border-cream-dark overflow-hidden">
          <div className="flex gap-1 p-1 border-b border-cream-dark bg-warm-white">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={preview === p}
                onClick={() => setPreview(p)}
                className={`${TAB} ${preview === p ? 'bg-cream-dark text-bark' : TAB_IDLE}`}
              >
                {p ? t('editor.markdown.preview') : t('editor.markdown.write')}
              </button>
            ))}
          </div>
          {preview ? (
            <div className="min-h-[240px] px-4 py-3 bg-warm-white">
              {markdown.trim()
                ? <RichContent doc={previewDoc} />
                : <p className="text-bark-muted">{t('editor.markdown.previewEmpty')}</p>}
            </div>
          ) : (
            <DictationField
              disabled={disabled}
              onText={(s) => onChange({ ...value, markdown: appendDictation(markdown, s) })}
            >
              {/* 16px and up, or iOS zooms the page in on focus. */}
              <textarea
                value={markdown}
                onChange={(e) => onChange({ ...value, markdown: e.target.value })}
                placeholder={placeholder}
                aria-label={t('editor.contentLabel')}
                disabled={disabled}
                rows={12}
                spellCheck
                className="block w-full min-h-[240px] bg-transparent px-4 py-3 text-base leading-relaxed text-bark placeholder-bark-muted focus:outline-none resize-y pr-12"
              />
            </DictationField>
          )}
          <p className="px-4 py-2 text-xs text-bark-muted border-t border-cream-dark bg-warm-white">
            {t('editor.markdown.help')}
          </p>
        </div>
      ) : (
        <RichTextEditorLazy
          value={rich}
          onChange={(doc) => onChange({ ...value, rich: doc })}
          disabled={disabled}
          media={false}
          label={t('editor.contentLabel')}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}
