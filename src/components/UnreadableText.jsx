import { useTranslation } from 'react-i18next'

/**
 * Stands in for a field that did not decrypt (`unreadableFields`, see
 * utils/encryption.js), where the field would otherwise just be missing.
 */
export default function UnreadableText({ className = '' }) {
  const { t } = useTranslation('common')
  return <p className={`italic text-bark-muted ${className}`}>{t('unreadable.content')}</p>
}
