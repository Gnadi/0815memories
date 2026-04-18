import { memo, useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Snowflake, Leaf, Sun, Wind, Clock, MapPin, Tag, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useMemories } from '../hooks/useMemories'
import { isOnThisDay } from '../utils/helpers'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import EncryptedImage from '../components/media/EncryptedImage'

const SEASONS = [
  { name: 'Winter', icon: Snowflake, months: [12, 1, 2] },
  { name: 'Spring', icon: Leaf, months: [3, 4, 5] },
  { name: 'Summer', icon: Sun, months: [6, 7, 8] },
  { name: 'Autumn', icon: Wind, months: [9, 10, 11] },
]

function getSeason(date) {
  const month = date.getMonth() + 1
  if ([12, 1, 2].includes(month)) return 'Winter'
  if ([3, 4, 5].includes(month)) return 'Spring'
  if ([6, 7, 8].includes(month)) return 'Summer'
  return 'Autumn'
}

function toDate(ts) {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts instanceof Date) return ts
  return new Date(ts)
}

function formatOverlayDate(date) {
  return date
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .toUpperCase()
}

const TimelineCard = memo(function TimelineCard({ memory }) {
  const navigate = useNavigate()
  const date = toDate(memory.date)
  const image = (memory.images && memory.images[0]) || memory.imageUrl

  return (
    <div className="relative flex gap-4 pb-8 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-kaydo border-2 border-cream mt-2 z-10 group-hover:scale-125 transition-transform" />
        <div className="w-px flex-1 bg-cream-dark mt-1" />
      </div>

      {/* Card */}
      <button
        onClick={() => navigate(`/memory/${memory.id}`)}
        className="flex-1 bg-warm-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left mb-1"
      >
        {/* Image */}
        {image && (
          <div className="relative w-full aspect-[4/3] overflow-hidden">
            <EncryptedImage
              src={image}
              alt={memory.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            {/* Date overlay */}
            <div className="absolute top-3 left-3">
              <span className="bg-warm-white/90 backdrop-blur-sm text-kaydo text-[10px] font-bold tracking-widest px-3 py-1.5 rounded-full">
                {formatOverlayDate(date)}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {!image && (
            <p className="text-xs font-bold tracking-widest text-kaydo mb-2">
              {formatOverlayDate(date)}
            </p>
          )}
          <h3 className="font-serif text-lg font-bold text-bark leading-snug mb-1">
            {memory.title}
          </h3>
          {memory.content && (
            <p className="text-sm text-bark-light line-clamp-2 leading-relaxed">
              {memory.content}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {memory.category && (
              <span className="flex items-center gap-1 text-[11px] text-bark-muted">
                <Tag className="w-3 h-3" />
                {memory.category}
              </span>
            )}
            {memory.location && (
              <span className="flex items-center gap-1 text-[11px] text-bark-muted">
                <MapPin className="w-3 h-3" />
                {memory.location}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  )
})

function SkeletonCard() {
  return (
    <div className="relative flex gap-4 pb-8">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-cream-dark mt-2" />
        <div className="w-px flex-1 bg-cream-dark mt-1" />
      </div>
      <div className="flex-1 bg-warm-white rounded-2xl overflow-hidden">
        <div className="w-full aspect-[4/3] bg-cream-dark animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-5 bg-cream-dark rounded animate-pulse w-3/4" />
          <div className="h-4 bg-cream-dark rounded animate-pulse w-full" />
          <div className="h-4 bg-cream-dark rounded animate-pulse w-2/3" />
        </div>
      </div>
    </div>
  )
}

export default function SmartTimelinePage() {
  const { familyId, encryptionKey } = useAuth()
  const { memories, loading } = useMemories(familyId, encryptionKey)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const availableYears = useMemo(() => {
    const years = [...new Set(memories.map((m) => toDate(m.date).getFullYear()))]
    return years.sort((a, b) => b - a)
  }, [memories])

  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [showOnThisDay, setShowOnThisDay] = useState(false)

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Activate "On This Day" filter when linked from the anniversary notification
  useEffect(() => {
    if (searchParams.get('filter') === 'onthisday') {
      setShowOnThisDay(true)
      setSelectedYear(null)
      setSelectedSeason(null)
    }
  }, [searchParams])

  // Auto-select most recent year once data loads (only when not in "On This Day" mode)
  useEffect(() => {
    if (!showOnThisDay && availableYears.length > 0 && selectedYear === null) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear, showOnThisDay])

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const date = toDate(m.date)
      if (showOnThisDay) return isOnThisDay(date)
      const yearMatch = !selectedYear || date.getFullYear() === selectedYear
      const seasonMatch = !selectedSeason || getSeason(date) === selectedSeason
      return yearMatch && seasonMatch
    })
  }, [memories, selectedYear, selectedSeason, showOnThisDay])

  const today = new Date()
  const todayLabel = today.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
  const seasonLabel = selectedSeason || 'all seasons'
  const yearLabel = selectedYear ? String(selectedYear) : 'all time'

  function clearFilters() {
    setSelectedYear(null)
    setSelectedSeason(null)
    setShowOnThisDay(false)
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-kaydo" />
            <span className="text-xs font-semibold text-kaydo tracking-widest uppercase">Family Vault</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-bark leading-tight">Smart Timeline</h1>
          <p className="text-bark-light mt-1 text-sm">Tracing the threads of our story.</p>
        </div>

        {/* On This Day Banner */}
        <button
          data-testid="onthisday-toggle"
          onClick={() => {
            const next = !showOnThisDay
            setShowOnThisDay(next)
            if (next) {
              setSelectedYear(null)
              setSelectedSeason(null)
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 transition-all text-left"
          style={
            showOnThisDay
              ? { backgroundColor: '#A04420', color: '#FFFDF9' }
              : { backgroundColor: '#F5E6D0', color: '#7A6A5E' }
          }
        >
          <Star className="w-4 h-4 flex-shrink-0" fill={showOnThisDay ? '#FFFDF9' : 'none'} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Heute vor 3 Jahren</p>
            <p className="text-xs opacity-75 leading-tight mt-0.5">{todayLabel} · Erinnerungen aus vergangenen Jahren</p>
          </div>
        </button>

        {/* Year Selector */}
        <div className={`flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-3 transition-opacity ${showOnThisDay ? 'opacity-30 pointer-events-none' : ''}`}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-16 rounded-full bg-cream-dark animate-pulse flex-shrink-0" />
            ))
          ) : (
            availableYears.map((year) => {
              const active = year === selectedYear
              return (
                <button
                  key={year}
                  onClick={() => setSelectedYear(active ? null : year)}
                  className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all"
                  style={
                    active
                      ? { backgroundColor: '#A04420', color: '#FFFDF9' }
                      : { backgroundColor: '#F5E6D0', color: '#7A6A5E' }
                  }
                >
                  {year}
                </button>
              )
            })
          )}
        </div>

        {/* Season Selector */}
        <div className={`flex flex-col gap-2 pb-3 mb-5 transition-opacity ${showOnThisDay ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedSeason(null)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={
                !selectedSeason
                  ? { backgroundColor: '#A04420', color: '#FFFDF9' }
                  : { backgroundColor: '#F5E6D0', color: '#7A6A5E' }
              }
            >
              All
            </button>
            {SEASONS.slice(0, 2).map(({ name, icon: Icon }) => {
              const active = selectedSeason === name
              return (
                <button
                  key={name}
                  onClick={() => setSelectedSeason(active ? null : name)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={
                    active
                      ? { backgroundColor: '#F5C518', color: '#2D1B0E' }
                      : { backgroundColor: '#F5E6D0', color: '#7A6A5E' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {name}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            {SEASONS.slice(2).map(({ name, icon: Icon }) => {
              const active = selectedSeason === name
              return (
                <button
                  key={name}
                  onClick={() => setSelectedSeason(active ? null : name)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={
                    active
                      ? { backgroundColor: '#F5C518', color: '#2D1B0E' }
                      : { backgroundColor: '#F5E6D0', color: '#7A6A5E' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stats bar */}
        {!loading && (
          <p className="text-xs text-bark-muted mb-6 font-medium">
            {filteredMemories.length === 0
              ? 'No memories found'
              : `${filteredMemories.length} ${filteredMemories.length === 1 ? 'memory' : 'memories'}`}
            {showOnThisDay ? ` · On this day · ${todayLabel}` : ''}
            {!showOnThisDay && selectedSeason ? ` in ${seasonLabel}` : ''}
            {!showOnThisDay && selectedYear ? ` · ${yearLabel}` : ''}
          </p>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="mt-2">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-bark-muted" />
            </div>
            <p className="font-serif text-lg font-semibold text-bark mb-1">No memories here yet</p>
            <p className="text-sm text-bark-muted max-w-xs">
              {showOnThisDay
                ? `Noch keine Erinnerungen vom ${todayLabel} aus vergangenen Jahren.`
                : selectedSeason
                  ? `No ${selectedSeason.toLowerCase()} memories found${selectedYear ? ` for ${selectedYear}` : ''}.`
                  : `No memories found${selectedYear ? ` for ${selectedYear}` : ''}.`}
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 text-sm text-kaydo font-medium hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div>
            {filteredMemories.map((memory) => (
              <TimelineCard key={memory.id} memory={memory} />
            ))}
          </div>
        )}
        </main>
      </div>
    </div>
  )
}
