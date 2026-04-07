import { Home, LogOut, Settings, BookHeart, Lock, ChefHat, BookMarked, Clock } from 'lucide-react'
import KaydoLogo from '../KaydoLogo'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { icon: Home, label: 'Home', route: '/home' },
  { icon: Clock, label: 'Timeline', route: '/timeline' },
  { icon: BookMarked, label: 'Scrapbooks', route: '/scrapbook' },
  { icon: ChefHat, label: 'Recipes', route: '/recipes' },
  { icon: BookHeart, label: 'Kid Journals', route: '/journal' },
  { icon: Lock, label: 'Black Box', route: '/blackbox' },
  { icon: Settings, label: 'Settings', route: '/settings' },
]

export default function Sidebar({ onPostMemory }) {
  const { isAdmin, logout } = useAuth()
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
          <h1 className="text-base font-bold text-bark leading-tight">The Living Room</h1>
          <p className="text-xs text-bark-muted">Our Private Space</p>
        </div>
      </div>

      {/* Post Memory button (admin only) */}
      {isAdmin && (
        <button
          onClick={onPostMemory}
          className="btn-kaydo w-full text-sm mb-6"
        >
          Post a Memory
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ icon: Icon, label, route }) => (
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
            {label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-bark-muted hover:text-kaydo transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Leave the Room
      </button>
    </aside>
  )
}
