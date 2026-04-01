import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookHeart, Plus, Lock, Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useMemories } from '../../hooks/useMemories'
import PostMemoryModal from '../admin/PostMemoryModal'

export default function AdminMobileBottomNav() {
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { addMemory } = useMemories(isAdmin ? familyId : null)

  if (!isAdmin) return null

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const navItems = [
    { label: 'Home', icon: Home, path: '/home' },
    { label: 'Journal', icon: BookHeart, path: '/journal' },
  ]

  const rightItems = [
    { label: 'BlackBox', icon: Lock, path: '/blackbox' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ]

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-warm-white border-t border-cream-dark"
        style={{ boxShadow: '0 -4px 20px rgba(45,27,14,0.08)' }}>
        <div className="flex items-end justify-around px-2 pb-2 pt-1">
          {navItems.map(({ label, icon: Icon, path }) => {
            const active = isActive(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]"
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}>
                  {label}
                </span>
                {active && (
                  <span className="w-1 h-1 rounded-full bg-hearth" />
                )}
              </button>
            )
          })}

          {/* Elevated Create Button */}
          <div className="flex flex-col items-center -mt-5 px-1">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #C25A2E, #D4784A)',
                boxShadow: '0 4px 16px rgba(194, 90, 46, 0.45)',
              }}
            >
              <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>
            <span className="text-[10px] font-medium text-bark-muted mt-1">Create</span>
            <span className="w-1 h-1 rounded-full opacity-0" />
          </div>

          {rightItems.map(({ label, icon: Icon, path }) => {
            const active = isActive(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]"
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}>
                  {label}
                </span>
                {active && (
                  <span className="w-1 h-1 rounded-full bg-hearth" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {showCreateModal && (
        <PostMemoryModal
          onClose={() => setShowCreateModal(false)}
          onSave={addMemory}
        />
      )}
    </>
  )
}
