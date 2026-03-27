import { Home, Compass, MessageSquare, User, BookOpen, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { icon: Home, label: 'Home', active: true },
  { icon: Compass, label: 'Discover' },
  { icon: MessageSquare, label: 'Messages' },
  { icon: User, label: 'Profile' },
  { icon: BookOpen, label: 'Our Memories' },
]

export default function Sidebar({ onPostMemory }) {
  const { isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen p-6 border-r border-cream-dark bg-cream">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-hearth rounded-lg flex items-center justify-center">
          <Home className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-bark leading-tight">The Living Room</h1>
          <p className="text-xs text-bark-muted">Our Private Space</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active
                ? 'bg-hearth text-white'
                : 'text-bark-light hover:bg-cream-dark hover:text-bark'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>

      {/* Post Memory button (admin only) */}
      {isAdmin && (
        <button
          onClick={onPostMemory}
          className="btn-hearth w-full text-sm mb-4"
        >
          Post a Memory
        </button>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-bark-muted hover:text-hearth transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Leave the Room
      </button>
    </aside>
  )
}
