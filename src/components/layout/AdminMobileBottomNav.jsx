import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookHeart, Plus, Lock, ChefHat, Camera, BookMarked, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useMemories } from '../../hooks/useMemories'
import { useScrapbooks } from '../../hooks/useScrapbooks'
import PostMemoryModal from '../admin/PostMemoryModal'

const TAP = { touchAction: 'manipulation' }

export default function AdminMobileBottomNav() {
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showChoiceSheet, setShowChoiceSheet] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  const { addMemory } = useMemories(isAdmin ? familyId : null)
  const { addScrapbook } = useScrapbooks(isAdmin ? familyId : null)

  // Hide entirely on the scrapbook editor (it has its own bottom toolbar)
  if (!isAdmin) return null
  if (location.pathname.match(/^\/scrapbook\/.+/)) return null

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const navItems = [
    { label: 'Home', icon: Home, path: '/home' },
    { label: 'Journal', icon: BookHeart, path: '/journal' },
  ]

  const rightItems = [
    { label: 'BlackBox', icon: Lock, path: '/blackbox' },
    { label: 'Recipes', icon: ChefHat, path: '/recipes' },
  ]

  const handleCreateScrapbook = async () => {
    setShowChoiceSheet(false)
    if (!familyId) { alert('Not authenticated — please reload the app.'); return }
    setCreating(true)
    try {
      const id = await addScrapbook({
        title: 'My Scrapbook',
        coverImageUrl: null,
        pages: [{ id: crypto.randomUUID(), backgroundColor: '#FDF6EC', backgroundPattern: 'none', elements: [] }],
      })
      navigate(`/scrapbook/${id}`)
    } catch (err) {
      console.error('Failed to create scrapbook:', err)
      alert('Could not create scrapbook. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-warm-white border-t border-cream-dark"
        style={{ boxShadow: '0 -4px 20px rgba(45,27,14,0.08)' }}
      >
        <div className="flex items-end justify-around px-2 pb-2 pt-1">
          {navItems.map(({ label, icon: Icon, path }) => {
            const active = isActive(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]"
                style={TAP}
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}>
                  {label}
                </span>
                {active && <span className="w-1 h-1 rounded-full bg-hearth" />}
              </button>
            )
          })}

          {/* Elevated Create Button */}
          <div className="flex flex-col items-center -mt-5 px-1">
            <button
              onClick={() => setShowChoiceSheet(true)}
              disabled={creating}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95"
              style={{
                touchAction: 'manipulation',
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
                style={TAP}
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-hearth' : 'text-bark-muted'}`}>
                  {label}
                </span>
                {active && <span className="w-1 h-1 rounded-full bg-hearth" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Choice Sheet */}
      {showChoiceSheet && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30"
            onClick={() => setShowChoiceSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-warm-white rounded-t-2xl pb-8 shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-cream-dark" />
            </div>
            <p className="text-center text-sm font-semibold text-bark mb-4 px-4">What would you like to create?</p>
            <div className="flex flex-col gap-2 px-4">
              <button
                onClick={() => { setShowChoiceSheet(false); setShowCreateModal(true) }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-cream hover:bg-cream-dark transition-colors text-left"
                style={TAP}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C25A2E, #D4784A)' }}>
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-bark text-sm">Post a Memory</p>
                  <p className="text-xs text-bark-muted mt-0.5">Share photos, stories, videos & voice memos</p>
                </div>
              </button>

              <button
                onClick={handleCreateScrapbook}
                className="flex items-center gap-4 p-4 rounded-2xl bg-cream hover:bg-cream-dark transition-colors text-left"
                style={TAP}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3B5E8A, #5A80B0)' }}>
                  <BookMarked className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-bark text-sm">Create Scrapbook</p>
                  <p className="text-xs text-bark-muted mt-0.5">Design beautiful memory pages with photos & stickers</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowChoiceSheet(false)}
              className="flex items-center justify-center gap-1.5 w-full mt-4 py-3 text-sm text-bark-muted"
              style={TAP}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </>
      )}

      {showCreateModal && (
        <PostMemoryModal
          onClose={() => setShowCreateModal(false)}
          onSave={addMemory}
        />
      )}
    </>
  )
}
