import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import PersonalSettingsPanel from '../components/settings/PersonalSettingsPanel'
import SettingsPanel from '../components/admin/SettingsPanel'

// Open to viewers for their own device's settings. The family's settings stay
// with the admins: SettingsPanel reads and writes the family document, which
// firestore.rules keeps to them.
export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const { t } = useTranslation('settings')

  return (
    <div className="min-h-screen bg-cream flex overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-3xl mx-auto w-full">
          <h1 className="text-2xl font-bold text-bark mb-6">{t('page.title')}</h1>
          <PersonalSettingsPanel />
          {isAdmin && (
            <div className="mt-6">
              <SettingsPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
