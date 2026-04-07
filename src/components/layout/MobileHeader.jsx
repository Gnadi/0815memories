import { LogOut, Settings, BookMarked } from 'lucide-react'
import KaydoLogo from '../KaydoLogo'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function MobileHeader() {
  const { logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-cream border-b border-cream-dark sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <KaydoLogo size={32} />
        <h1 className="text-lg font-bold text-bark">Kaydo</h1>
      </div>
      <div className="flex items-center gap-1">
        {isAdmin && (
          <button
            onClick={() => navigate('/scrapbook')}
            className="p-2 text-bark-light hover:text-kaydo transition-colors"
          >
            <BookMarked className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-bark-light hover:text-kaydo transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button onClick={handleLogout} className="p-2 text-bark-light hover:text-kaydo transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
