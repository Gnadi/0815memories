import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, BookHeart, Plus, Lock, Camera, BookMarked, CalendarHeart, LayoutGrid, Film, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { LANDING_PATHS } from '../../i18n'
import { LAYOUT_PRESETS } from '../scrapbook/layoutPresets'
import { devError } from '../../utils/devLog'
import usePlatform from '../../hooks/usePlatform'

// Lazy: this nav is mounted on every route, so a static import dragged the
// whole upload stack — media uploader, encrypted image/video, voice recorder,
// polaroid editor — into the startup bundle, landing page included.
const PostEntryModal = lazy(() => import('../admin/PostEntryModal'))

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

// The bar follows the conventions of the phone it runs on. iOS: a flat,
// translucent tab bar, the active tab shown by colour alone, and the create
// button sitting in the row as Apple's tab bars have no raised buttons.
// Android: Material's navigation bar, the active icon on a pill, and the
// create button a raised rounded square like a floating action button.
// Anything else keeps the original look. The tabs are the same everywhere, so
// a new page is added once.
const STYLES = {
  ios: {
    bar: 'bg-warm-white/85 backdrop-blur-xl border-t border-cream-dark',
    shadow: undefined,
    row: 'flex items-end justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]',
    label: 'text-[10px] font-medium',
    dot: false,
    pill: false,
    create: { wrap: 'flex flex-col items-center px-1', button: 'w-9 h-9 rounded-full', icon: 'w-5 h-5' },
  },
  android: {
    bar: 'bg-warm-white border-t border-cream-dark',
    shadow: '0 -2px 8px rgba(45,27,14,0.06)',
    row: 'flex items-end justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
    label: 'text-xs font-medium',
    dot: false,
    pill: true,
    create: { wrap: 'flex flex-col items-center -mt-5 px-1', button: 'w-14 h-14 rounded-2xl', icon: 'w-7 h-7' },
  },
  other: {
    bar: 'bg-warm-white border-t border-cream-dark',
    shadow: '0 -4px 20px rgba(45,27,14,0.08)',
    row: 'flex items-end justify-around px-2 pb-2 pt-1',
    label: 'text-[10px] font-medium',
    dot: true,
    pill: false,
    create: { wrap: 'flex flex-col items-center -mt-5 px-1', button: 'w-14 h-14 rounded-full', icon: 'w-7 h-7' },
  },
}

export default function AdminMobileBottomNav() {
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const [showChoiceSheet, setShowChoiceSheet] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const platform = usePlatform()
  const style = STYLES[platform] || STYLES.other

  // The create sheet gets an entry in the history of its own, so that the back
  // button closes the sheet instead of leaving the page underneath it: on
  // Android that button is part of the phone, and pressing it with the sheet
  // open took people off the page they were on. sheetEntry says whether that
  // entry is still on top and has to be undone when the sheet closes another way.
  const sheetEntry = useRef(false)
  useEffect(() => {
    if (!showChoiceSheet) return undefined
    const onPop = () => {
      sheetEntry.current = false
      setShowChoiceSheet(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [showChoiceSheet])

  const openSheet = () => {
    // The router's own state is kept, so going back lands on the same page.
    window.history.pushState({ ...window.history.state, kaydoSheet: true }, '')
    sheetEntry.current = true
    setShowChoiceSheet(true)
  }

  const closeSheet = () => {
    setShowChoiceSheet(false)
    if (sheetEntry.current) {
      sheetEntry.current = false
      window.history.back()
    }
  }

  // Going somewhere from the sheet takes the sheet's place in the history, so
  // back from there returns to the page the sheet was opened on.
  const leaveSheetTo = (path) => {
    const replace = sheetEntry.current
    sheetEntry.current = false
    setShowChoiceSheet(false)
    navigate(path, { replace })
  }

  // The writers load on first use, for the reason PostEntryModal does: a
  // static import brought the memory and scrapbook services, Firestore queries
  // and encryption included, into the startup bundle for a button most visits
  // never press.
  const addMemory = async (memory) => {
    const { addMemory: add } = await import('../../services/memories')
    return add(familyId, encryptionKey, memory)
  }

  // Hide on public/auth pages and on the full-screen editors
  if (!isAdmin) return null
  const publicPaths = [...Object.values(LANDING_PATHS), '/login', '/signup']
  if (publicPaths.includes(location.pathname)) return null
  if (location.pathname.startsWith('/family/')) return null
  if (location.pathname.match(/^\/(scrapbook|collage|highlight)\/.+/)) return null
  // A journal entry is written and read full-screen. The bar sat on top of the
  // editor's bottom edge, its save button included.
  if (location.pathname.match(/^\/journal\/[^/]+\/(new|edit|view)(\/|$)/)) return null

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const navItems = [
    { label: t('mobileNav.home'), icon: Home, path: '/home' },
    { label: t('mobileNav.journal'), icon: BookHeart, path: '/journal' },
  ]

  const rightItems = [
    { label: t('mobileNav.blackBox'), icon: Lock, path: '/blackbox' },
    { label: t('mobileNav.scrapbooks'), icon: BookMarked, path: '/scrapbook' },
  ]

  const renderTab = ({ label, icon: Icon, path }) => {
    const active = isActive(path)
    const tone = active ? 'text-kaydo' : 'text-bark-muted'
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]"
        style={TAP}
      >
        <span className={style.pill
          ? `flex items-center justify-center px-5 py-1 rounded-full transition-colors ${active ? 'bg-kaydo/15' : ''}`
          : 'flex'}
        >
          <Icon
            className={`w-6 h-6 transition-colors ${tone}`}
            strokeWidth={active ? 2.5 : 1.8}
          />
        </span>
        <span className={`${style.label} transition-colors ${tone}`}>
          {label}
        </span>
        {style.dot && active && <span className="w-1 h-1 rounded-full bg-kaydo" />}
      </button>
    )
  }

  const handleCreateScrapbook = async () => {
    if (!familyId) { closeSheet(); alert(t('createSheet.notAuthenticated')); return }
    // The sheet's history entry stays until the scrapbook exists: going back
    // now would race the navigation below.
    setShowChoiceSheet(false)
    setCreating(true)
    try {
      const { addScrapbook } = await import('../../services/scrapbooks')
      const id = await addScrapbook(familyId, encryptionKey, {
        title: t('createSheet.defaultScrapbookTitle'),
        coverImageUrl: null,
        pages: [makeCoverPage()],
      })
      leaveSheetTo(`/scrapbook/${id}`)
    } catch (err) {
      if (sheetEntry.current) {
        sheetEntry.current = false
        window.history.back()
      }
      devError('Failed to create scrapbook:', err)
      alert(t('createSheet.createError'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 ${style.bar}`}
        style={style.shadow ? { boxShadow: style.shadow } : undefined}
        data-platform={platform}
      >
        <div className={style.row}>
          {navItems.map(renderTab)}

          {/* Elevated Create Button */}
          <div className={style.create.wrap}>
            <button
              onClick={openSheet}
              disabled={creating}
              aria-label={t('mobileNav.create')}
              className={`${style.create.button} flex items-center justify-center transition-transform active:scale-95`}
              style={{
                touchAction: 'manipulation',
                background: 'linear-gradient(135deg, #C25A2E, #D4784A)',
                boxShadow: platform === 'ios' ? undefined : '0 4px 16px rgba(194, 90, 46, 0.45)',
              }}
            >
              <Plus className={`${style.create.icon} text-white`} strokeWidth={2.5} />
            </button>
            <span className={`${style.label} text-bark-muted mt-1`} aria-hidden="true">{t('mobileNav.create')}</span>
            {style.dot && <span className="w-1 h-1 rounded-full opacity-0" />}
          </div>

          {rightItems.map(renderTab)}
        </div>
      </nav>

      {/* Choice Sheet */}
      {showChoiceSheet && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30"
            onClick={closeSheet}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-warm-white rounded-t-2xl pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-cream-dark" />
            </div>
            <p className="text-center text-sm font-semibold text-bark mb-4 px-4">{t('createSheet.title')}</p>
            <div className="flex flex-col gap-2 px-4">
              <button
                onClick={() => { closeSheet(); setShowCreateModal(true) }}
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

              <button
                onClick={() => leaveSheetTo('/collages')}
                className="flex items-center gap-4 p-4 rounded-2xl bg-cream hover:bg-cream-dark transition-colors text-left"
                style={TAP}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7B3F6E, #A8628F)' }}>
                  <LayoutGrid className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-bark text-sm">{t('createSheet.createCollage')}</p>
                  <p className="text-xs text-bark-muted mt-0.5">{t('createSheet.createCollageDesc')}</p>
                </div>
              </button>

              <button
                onClick={() => leaveSheetTo('/highlights')}
                className="flex items-center gap-4 p-4 rounded-2xl bg-cream hover:bg-cream-dark transition-colors text-left"
                style={TAP}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C25A2E, #E0946A)' }}>
                  <Film className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-bark text-sm">{t('createSheet.createHighlight')}</p>
                  <p className="text-xs text-bark-muted mt-0.5">{t('createSheet.createHighlightDesc')}</p>
                </div>
              </button>

              <button
                onClick={() => leaveSheetTo('/our-year')}
                className="flex items-center gap-4 p-4 rounded-2xl bg-cream hover:bg-cream-dark transition-colors text-left"
                style={TAP}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #A04420, #C25A2E)' }}>
                  <CalendarHeart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-bark text-sm">{t('createSheet.ourYearChapter')}</p>
                  <p className="text-xs text-bark-muted mt-0.5">{t('createSheet.ourYearChapterDesc')}</p>
                </div>
              </button>
            </div>
            <button
              onClick={closeSheet}
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
        <Suspense fallback={null}>
          <PostEntryModal
            type="memory"
            onClose={() => setShowCreateModal(false)}
            onSave={addMemory}
          />
        </Suspense>
      )}
    </>
  )
}
