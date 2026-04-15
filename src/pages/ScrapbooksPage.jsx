import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useScrapbooks } from '../hooks/useScrapbooks'
import ScrapbookCard from '../components/scrapbook/ScrapbookCard'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import { LAYOUT_PRESETS } from '../components/scrapbook/layoutPresets'

const COVER_PRESET_IDS = ['cover-magazine', 'cover-title-hero', 'cover-paris', 'cover-4grid']

const COVER_SCHEMES = [
  // Light backgrounds → dark titles
  { bg: '#FDF6EC', titleColor: '#2D1B0E', accentColor: '#C25A2E' }, // cream + bark + kaydo
  { bg: '#FBCFE8', titleColor: '#4A1942', accentColor: '#7B3F6E' }, // blush + dark purple + mauve
  { bg: '#EFF6FF', titleColor: '#1E3A5F', accentColor: '#3B5E8A' }, // ice blue + navy + blue
  { bg: '#F0FFF4', titleColor: '#1B4332', accentColor: '#4A7C59' }, // mint + dark forest + green
  { bg: '#FAF5FF', titleColor: '#3B0764', accentColor: '#7B3F6E' }, // lavender + deep violet + mauve
  { bg: '#FEFCE8', titleColor: '#451A03', accentColor: '#C25A2E' }, // warm yellow + dark brown + orange
  { bg: '#FFF5F5', titleColor: '#7F1D1D', accentColor: '#C25A2E' }, // blush white + dark red + orange
  // Dark backgrounds → light titles
  { bg: '#2D1B0E', titleColor: '#FFFDF9', accentColor: '#D4784A' }, // dark bark + white + light orange
  { bg: '#3B5E8A', titleColor: '#FFFDF9', accentColor: '#BFDBFE' }, // dark blue + white + sky
  { bg: '#C25A2E', titleColor: '#FFFDF9', accentColor: '#FEFCE8' }, // kaydo orange + white + pale yellow
  { bg: '#4A7C59', titleColor: '#FFFDF9', accentColor: '#DCFCE7' }, // forest green + white + mint
  { bg: '#7B3F6E', titleColor: '#FFFDF9', accentColor: '#FBCFE8' }, // mauve + white + blush
]

function makeCoverPage() {
  const currentYear = new Date().getFullYear().toString()
  const presetId = COVER_PRESET_IDS[Math.floor(Math.random() * COVER_PRESET_IDS.length)]
  const scheme = COVER_SCHEMES[Math.floor(Math.random() * COVER_SCHEMES.length)]
  const isPhotoOverlay = presetId === 'cover-4grid'

  const preset = LAYOUT_PRESETS.find((p) => p.id === presetId)
  const elements = preset.elements.map((el) => {
    if (el.type !== 'text') return { ...el, id: crypto.randomUUID() }
    const isYear = el.text === '2025'
    const color = isPhotoOverlay ? '#FFFFFF' : isYear ? scheme.accentColor : scheme.titleColor
    return {
      ...el,
      id: crypto.randomUUID(),
      color,
      ...(isYear ? { text: currentYear } : {}),
    }
  })

  return {
    id: crypto.randomUUID(),
    backgroundColor: scheme.bg,
    backgroundPattern: 'none',
    elements,
    customizable: false,
  }
}

export default function ScrapbooksPage() {
  const navigate = useNavigate()
  const { familyId, encryptionKey } = useAuth()
  const { scrapbooks, loading, addScrapbook, deleteScrapbook } = useScrapbooks(familyId, encryptionKey)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    if (!familyId) { setError('Not authenticated. Please reload and try again.'); return }
    setCreating(true)
    setError(null)
    try {
      const id = await addScrapbook({
        title: 'My Scrapbook',
        coverImageUrl: null,
        pages: [makeCoverPage()],
      })
      navigate(`/scrapbook/${id}`)
    } catch (err) {
      console.error('Failed to create scrapbook:', err)
      setError('Could not create scrapbook. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
          {/* Error banner */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-bark">Scrapbooks</h1>
              <p className="text-sm text-bark-muted mt-0.5">Create beautiful digital memory books</p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-kaydo flex items-center gap-2 text-sm"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              New Scrapbook
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-kaydo" />
            </div>
          ) : scrapbooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-cream-dark rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-10 h-10 text-bark-muted" />
              </div>
              <h2 className="text-lg font-semibold text-bark mb-2">No scrapbooks yet</h2>
              <p className="text-sm text-bark-muted mb-6 max-w-xs">
                Create your first digital scrapbook with photos, stickers, text, and beautiful layouts.
              </p>
              <button onClick={handleCreate} disabled={creating} className="btn-kaydo flex items-center gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Scrapbook
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {scrapbooks.map((s) => (
                <ScrapbookCard key={s.id} scrapbook={s} onDelete={deleteScrapbook} />
              ))}
              {/* Quick create card */}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="aspect-[4/3] rounded-2xl border-2 border-dashed border-cream-dark hover:border-kaydo hover:bg-kaydo/5 transition-colors flex flex-col items-center justify-center gap-2 text-bark-muted hover:text-kaydo"
              >
                {creating ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Plus className="w-8 h-8" />
                )}
                <span className="text-xs font-medium">New Scrapbook</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
