import { Home, Bell, LogOut, Settings, BookHeart, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function MobileHeader() {
  const { isAdmin, logout } = useAuth()
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
      <div className="flex items-center gap-3">
        <button className="text-bark-light hover:text-hearth">
          <Bell className="w-5 h-5" />
        </button>
        {isAdmin && (
          <>
            <button onClick={() => navigate('/journal')} className="text-bark-light hover:text-hearth">
              <BookHeart className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/blackbox')} className="text-bark-light hover:text-hearth">
              <Lock className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/settings')} className="text-bark-light hover:text-hearth">
              <Settings className="w-5 h-5" />
            </button>
          </>
        )}
        <button onClick={handleLogout} className="text-bark-light hover:text-hearth">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
