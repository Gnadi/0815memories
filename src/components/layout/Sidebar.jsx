import { Home, LogOut, Settings, BookHeart, Lock, ChefHat, BookMarked, Clock, CalendarHeart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import KaydoLogo from '../KaydoLogo'
import LanguageSwitcher from '../LanguageSwitcher'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { icon: Home, labelKey: 'nav.home', route: '/home' },
  { icon: Clock, labelKey: 'nav.timeline', route: '/timeline' },
  { icon: BookMarked, labelKey: 'nav.scrapbooks', route: '/scrapbook' },
  { icon: ChefHat, labelKey: 'nav.recipes', route: '/recipes' },
  { icon: BookHeart, labelKey: 'nav.kidJournals', route: '/journal' },
  { icon: Lock, labelKey: 'nav.blackBox', route: '/blackbox' },
  // "Our Year" belongs to two people, so — unlike the rest of this list — it is
  // never shown to viewers.
  { icon: CalendarHeart, labelKey: 'nav.ourYear', route: '/our-year', adminOnly: true },
  { icon: Settings, labelKey: 'nav.settings', route: '/settings' },
]

export default function Sidebar({ onPostMemory }) {
  const { isAdmin, logout } = useAuth()
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const isActive = (route) =>
    location.pathname === route || location.pathname.startsWith(route + '/')

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen p-6 border-r border-cream-dark bg-cream">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-10">
        <KaydoLogo size={32} />
        <div>
          <h1 className="text-base font-bold text-bark leading-tight">{t('brand.livingRoom')}</h1>
          <p className="text-xs text-bark-muted">{t('brand.privateSpace')}</p>
        </div>
      </div>

      {/* Post Memory button (admin only) */}
      {isAdmin && (
        <button
          onClick={onPostMemory}
          className="btn-kaydo w-full text-sm mb-6"
        >
          {t('buttons.postMemory')}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ icon: Icon, labelKey, route }) => (
          <button
            key={route}
            onClick={() => navigate(route)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive(route)
                ? 'bg-kaydo text-white'
                : 'text-bark-light hover:bg-cream-dark hover:text-bark'
            }`}
          >
            <Icon className="w-5 h-5" />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {/* Language */}
      <div className="mb-3">
        <LanguageSwitcher variant="sidebar" />
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-bark-muted hover:text-kaydo transition-colors"
      >
        <LogOut className="w-5 h-5" />
        {t('buttons.leaveRoom')}
      </button>
    </aside>
  )
}
