import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smartphone } from 'lucide-react'
import usePWAInstall, { isIOSBrowser } from '../../hooks/usePWAInstall'

// Putting Kaydo on the home screen, for anyone who dismissed the install
// banner or never saw it. On iPhone and iPad it is also what makes
// notifications possible at all (isPushSupported).
export default function InstallSettings() {
  const { t } = useTranslation('settings')
  const { canInstall, installed, promptInstall } = usePWAInstall()
  const [ios] = useState(isIOSBrowser)

  let body
  if (installed) {
    body = <p className="text-xs text-bark-muted">{t('install.installed')}</p>
  } else if (canInstall) {
    body = (
      <>
        <p className="text-xs text-bark-muted mb-3">{t('install.description')}</p>
        <button type="button" onClick={promptInstall} className="btn-kaydo text-sm px-4 py-2">
          {t('install.button')}
        </button>
      </>
    )
  } else {
    // No prompt to show: Safari never offers one, and other browsers only once
    // they have decided the site is worth it. Say where the menu item is.
    body = (
      <p className="text-xs text-bark-muted">
        {ios ? t('install.ios') : t('install.manual')}
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-bark mb-1.5">
        <Smartphone className="w-4 h-4" />
        {t('install.label')}
      </div>
      {body}
    </div>
  )
}
