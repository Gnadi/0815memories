import { LogOut, Settings, ChefHat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import KaydoLogo from '../KaydoLogo'
import FeedbackLauncher from '../FeedbackLauncher'
import TextSizeSwitcher from '../TextSizeSwitcher'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function MobileHeader() {
  const { logout } = useAuth()
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // The icons grow with the reader's text size (src/utils/textSize.js) only up
  // to a cap, and the name gives way first: five icons at full scale do not
  // fit a phone from about 170 percent, and a page wider than the screen makes
  // the phone browser zoom the whole app out.
  return (
    <header className="lg:hidden flex items-center justify-between gap-2 px-[min(1rem,16px)] py-3 bg-cream border-b border-cream-dark sticky top-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        <KaydoLogo size={32} />
        <h1 className="text-lg font-bold text-bark truncate">Kaydo</h1>
      </div>
      <div className="flex items-center gap-[min(0.25rem,4px)] shrink-0">
        {/* Everyone's: a viewer reads the recipes an admin has shared. */}
        <button
          onClick={() => navigate('/recipes')}
          className="p-[min(0.5rem,10px)] text-bark-light hover:text-kaydo transition-colors"
          aria-label={t('nav.recipes')}
        >
          <ChefHat className="size-[min(1.25rem,26px)]" />
        </button>
        <TextSizeSwitcher variant="icon" />
        <FeedbackLauncher variant="icon" />
        <button
          onClick={() => navigate('/settings')}
          className="p-[min(0.5rem,10px)] text-bark-light hover:text-kaydo transition-colors"
          aria-label={t('nav.settings')}
        >
          <Settings className="size-[min(1.25rem,26px)]" />
        </button>
        <button onClick={handleLogout} className="p-[min(0.5rem,10px)] text-bark-light hover:text-kaydo transition-colors" aria-label={t('buttons.leaveRoom')}>
          <LogOut className="size-[min(1.25rem,26px)]" />
        </button>
      </div>
    </header>
  )
}
