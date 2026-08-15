import { Home, LogOut, Settings, BookHeart, Lock, ChefHat, BookMarked, Clock, CalendarHeart, LayoutGrid, Film } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import KaydoLogo from '../KaydoLogo'
import LanguageSwitcher from '../LanguageSwitcher'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

// `adminOnly` must mirror firestore.rules. Scrapbooks, recipes, journals and the
// Black Box were all missing it while their rules require isFamilyAdmin, so a
// viewer was shown four items that led to a denied listener and an empty screen
// — /scrapbook did not even redirect. Everything a viewer cannot read is now
// flagged, and the routes carry the same check for anyone arriving by URL.
const navItems = [
  { icon: Home, labelKey: 'nav.home', route: '/home' },
  { icon: Clock, labelKey: 'nav.timeline', route: '/timeline' },
  { icon: BookMarked, labelKey: 'nav.scrapbooks', route: '/scrapbook', adminOnly: true },
  { icon: LayoutGrid, labelKey: 'nav.collages', route: '/collages', adminOnly: true },
  { icon: Film, labelKey: 'nav.highlights', route: '/highlights', adminOnly: true },
  { icon: ChefHat, labelKey: 'nav.recipes', route: '/recipes', adminOnly: true },
  { icon: BookHeart, labelKey: 'nav.kidJournals', route: '/journal', adminOnly: true },
  { icon: Lock, labelKey: 'nav.blackBox', route: '/blackbox', adminOnly: true },
  // "Our Year" is narrower still: admin-only here, and the rules restrict it to
  // the two participants rather than every admin.
  { icon: CalendarHeart, labelKey: 'nav.ourYear', route: '/our-year', adminOnly: true },
  // SettingsPage itself already bounces viewers to /home, so offering it was the
  // same defect one page further along.
  { icon: Settings, labelKey: 'nav.settings', route: '/settings', adminOnly: true },
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
