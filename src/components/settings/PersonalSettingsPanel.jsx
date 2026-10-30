import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import LanguageSwitcher from '../LanguageSwitcher'
import TextSizeSwitcher from '../TextSizeSwitcher'
import NotificationSettings from './NotificationSettings'
import InstallSettings from './InstallSettings'
import SessionSettings from './SessionSettings'
import UsageSettings from './UsageSettings'

// The settings everyone has, viewers included. All of them belong to this
// device rather than to an account, since viewers have none: nothing here
// reads or writes family documents, so firestore.rules has nothing to gate.
// The push token is the one write, and the rules already allow every family
// member theirs.
export default function PersonalSettingsPanel() {
  const { t } = useTranslation('settings')

  return (
    <div className="bg-warm-white rounded-2xl p-4 lg:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-5 h-5 text-kaydo" />
        <h2 className="text-lg font-bold text-bark">{t('personal.title')}</h2>
      </div>
      <p className="text-xs text-bark-muted mb-6">{t('personal.description')}</p>

      <div className="mb-6">
        <LanguageSwitcher variant="settings" />
      </div>

      <div className="mb-6">
        <TextSizeSwitcher variant="settings" />
      </div>

      <div className="mb-6">
        <NotificationSettings />
      </div>

      <div className="mb-6 pt-6 border-t border-cream-dark">
        <InstallSettings />
      </div>

      <div className="mb-6 pt-6 border-t border-cream-dark">
        <UsageSettings />
      </div>

      <div className="pt-6 border-t border-cream-dark">
        <SessionSettings />
      </div>
    </div>
  )
}
