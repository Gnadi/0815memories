import { Home, LogOut, Settings, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

export default function MobileHeader() {
  const { logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-cream border-b border-cream-dark sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-hearth rounded-lg flex items-center justify-center">
          <Home className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-lg font-bold text-bark">Our Hearth</h1>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2 text-bark-light hover:text-hearth transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-bark-light hover:text-hearth transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button onClick={handleLogout} className="p-2 text-bark-light hover:text-hearth transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
