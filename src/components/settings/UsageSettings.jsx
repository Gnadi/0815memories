import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'
import { isUsageOptedOut, setUsageOptedOut } from '../../services/usage'
import SettingSwitch from './SettingSwitch'

// Whether this device adds to the usage log (services/usage.js). Like the other
// personal settings it belongs to the device, not to an account, so a viewer
// can switch it off too. On by default during the test phase; the invitation
// and the privacy policy say so.
export default function UsageSettings() {
  const { t } = useTranslation('settings')
  const [on, setOn] = useState(() => !isUsageOptedOut())
  const labelId = useId()

  const toggle = () => {
    setUsageOptedOut(on)
    setOn(!on)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div id={labelId} className="flex items-center gap-1.5 text-sm font-medium text-bark mb-1.5">
          <BarChart3 className="w-4 h-4" />
          {t('usage.label')}
        </div>
        <p className="text-xs text-bark-muted">{on ? t('usage.on') : t('usage.off')}</p>
      </div>
      <SettingSwitch on={on} onToggle={toggle} labelledBy={labelId} />
    </div>
  )
}
