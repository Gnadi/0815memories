import { useTranslation } from 'react-i18next'
import { Mic, Square } from 'lucide-react'
import useDictation from '../hooks/useDictation'

/**
 * Notice shown under a field while the microphone is open, or when dictation
 * failed. Shared by the text fields and the rich text editor.
 */
export function DictationStatus({ listening, error }) {
  const { t } = useTranslation('common')
  if (error) {
    return <p role="alert" className="text-xs text-red-500 mt-1">{t(`dictation.error.${error}`)}</p>
  }
  if (!listening) return null
  return <p role="status" className="text-xs text-bark-muted mt-1">{t('dictation.notice')}</p>
}

/**
 * Wraps a <textarea> and adds a dictation button in its bottom-right corner.
 * The textarea should have `pr-12` so text does not run under the button.
 * Renders the field unchanged where the browser cannot recognise speech.
 *
 * @param {(spoken: string) => void} onText Called with each dictated phrase;
 *   append it to the field's value (see appendDictation).
 */
export default function DictationField({ onText, disabled = false, children }) {
  const { t } = useTranslation('common')
  const { supported, listening, error, toggle } = useDictation(onText)

  if (!supported) return children

  return (
    <div>
      <div className="relative">
        {children}
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-pressed={listening}
          aria-label={listening ? t('dictation.stop') : t('dictation.start')}
          title={listening ? t('dictation.stop') : t('dictation.start')}
          className={`absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
            listening ? 'bg-red-500 text-white animate-pulse' : 'bg-cream text-bark-light hover:bg-cream-dark'
          }`}
        >
          {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
      <DictationStatus listening={listening} error={error} />
    </div>
  )
}
