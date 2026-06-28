import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, BookHeart, Plus, Lock, ChefHat, Camera, BookMarked, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useMemories } from '../../hooks/useMemories'
import { useScrapbooks } from '../../hooks/useScrapbooks'
import PostMemoryModal from '../admin/PostMemoryModal'
import { LAYOUT_PRESETS } from '../scrapbook/layoutPresets'
import { devError } from '../../utils/devLog'

function makeCoverPage() {
  const preset = LAYOUT_PRESETS.find((p) => p.id === 'cover-magazine')
  const currentYear = new Date().getFullYear().toString()
  const elements = preset.elements.map((el) => ({
    ...el,
    id: crypto.randomUUID(),
    ...(el.type === 'text' && el.text === '2025' ? { text: currentYear } : {}),
  }))
  return {
    id: crypto.randomUUID(),
    backgroundColor: '#FBCFE8',
    backgroundPattern: 'none',
    elements,
    customizable: false,
  }
}

const TAP = { touchAction: 'manipulation' }

export default function AdminMobileBottomNav() {
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const [showChoiceSheet, setShowChoiceSheet] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  const { addMemory } = useMemories(isAdmin ? familyId : null, encryptionKey)
  const { addScrapbook } = useScrapbooks(isAdmin ? familyId : null, encryptionKey)

  // Hide on public/auth pages and the scrapbook editor
  if (!isAdmin) return null
  const publicPaths = ['/', '/login', '/signup']
  if (publicPaths.includes(location.pathname)) return null
  if (location.pathname.startsWith('/family/')) return null
  if (location.pathname.match(/^\/scrapbook\/.+/)) return null

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const navItems = [
    { label: t('mobileNav.home'), icon: Home, path: '/home' },
    { label: t('mobileNav.journal'), icon: BookHeart, path: '/journal' },
  ]

  const rightItems = [
    { label: t('mobileNav.blackBox'), icon: Lock, path: '/blackbox' },
    { label: t('mobileNav.recipes'), icon: ChefHat, path: '/recipes' },
  ]

  const handleCreateScrapbook = async () => {
    setShowChoiceSheet(false)
    if (!familyId) { alert(t('createSheet.notAuthenticated')); return }
    setCreating(true)
    try {
      const id = await addScrapbook({
        title: t('createSheet.defaultScrapbookTitle'),
        coverImageUrl: null,
        pages: [makeCoverPage()],
      })
      navigate(`/scrapbook/${id}`)
    } catch (err) {
      devError('Failed to create scrapbook:', err)
      alert(t('createSheet.createError'))
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
                  className={`w-6 h-6 transition-colors ${active ? 'text-kaydo' : 'text-bark-muted'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-kaydo' : 'text-bark-muted'}`}>
                  {label}
                </span>
                {active && <span className="w-1 h-1 rounded-full bg-kaydo" />}
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
            <span className="text-[10px] font-medium text-bark-muted mt-1">{t('mobileNav.create')}</span>
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
                  className={`w-6 h-6 transition-colors ${active ? 'text-kaydo' : 'text-bark-muted'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-kaydo' : 'text-bark-muted'}`}>
                  {label}
                </span>
                {active && <span className="w-1 h-1 rounded-full bg-kaydo" />}
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
            <p className="text-center text-sm font-semibold text-bark mb-4 px-4">{t('createSheet.title')}</p>
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
                  <p className="font-semibold text-bark text-sm">{t('createSheet.postMemory')}</p>
                  <p className="text-xs text-bark-muted mt-0.5">{t('createSheet.postMemoryDesc')}</p>
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
                  <p className="font-semibold text-bark text-sm">{t('createSheet.createScrapbook')}</p>
                  <p className="text-xs text-bark-muted mt-0.5">{t('createSheet.createScrapbookDesc')}</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowChoiceSheet(false)}
              className="flex items-center justify-center gap-1.5 w-full mt-4 py-3 text-sm text-bark-muted"
              style={TAP}
            >
              <X className="w-4 h-4" />
              {t('buttons.cancel')}
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
