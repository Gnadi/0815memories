import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useMemories } from '../hooks/useMemories'
import { useStories } from '../hooks/useStories'
import { useAuth } from '../contexts/AuthContext'
import StoryRing from '../components/StoryRing'
import MemoryCard from '../components/MemoryCard'
import { cloudinaryUrl } from '../utils/cloudinary'

function formatStoryLabel(dateValue) {
  if (!dateValue) return ''
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Home() {
  const { memories, loading: memoriesLoading } = useMemories()
  const { stories, loading: storiesLoading } = useStories()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const featuredMemory = memories.find(m => m.featured) ?? memories[0]
  const feedMemories = memories.filter(m => m.id !== featuredMemory?.id)

  return (
    <div className="space-y-6">
      {/* Daily Moments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-hearth-text">Daily Moments</h2>
          <button className="text-xs font-bold uppercase tracking-wider text-terra hover:text-terra-dark">
            View All
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {isAdmin && (
            <StoryRing
              isAdd
              label="Add"
              onClick={() => navigate('/admin')}
            />
          )}

          {storiesLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-hearth-border animate-pulse" />
                  <div className="w-10 h-2.5 rounded bg-hearth-border animate-pulse" />
                </div>
              ))
            : stories.map((story, idx) => (
                <StoryRing
                  key={story.id}
                  image={cloudinaryUrl(story.image, { width: 112, height: 112 })}
                  label={story.label || formatStoryLabel(story.date)}
                  hasRing={idx === 0}
                />
              ))}
        </div>
      </section>

      {/* Featured memory hero */}
      {featuredMemory && !memoriesLoading && (
        <section>
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group"
            onClick={() => navigate(`/memory/${featuredMemory.id}`)}
          >
            {featuredMemory.images?.[0] && (
              <img
                src={cloudinaryUrl(featuredMemory.images[0], { width: 900, height: 500 })}
                alt={featuredMemory.title}
                className="w-full aspect-[16/9] object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              {featuredMemory.category && (
                <span className="inline-flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-bold px-2.5 py-1 rounded-full mb-2 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  {featuredMemory.category}
                  {' · '}
                  <span className="font-normal normal-case tracking-normal opacity-80">just now</span>
                </span>
              )}
              <h3 className="text-white text-xl font-bold leading-tight">
                {featuredMemory.title}
              </h3>
              {featuredMemory.description && (
                <p className="text-white/80 text-sm mt-1 line-clamp-2">
                  {featuredMemory.description}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Memory feed */}
      <section>
        {memoriesLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card p-0 overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex justify-between">
                  <div className="h-4 w-24 bg-hearth-border rounded animate-pulse" />
                  <div className="h-4 w-4 bg-hearth-border rounded animate-pulse" />
                </div>
                <div className="w-full aspect-[4/3] bg-hearth-border animate-pulse" />
                <div className="px-4 py-4 space-y-2">
                  <div className="h-4 w-3/4 bg-hearth-border rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-hearth-border rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : feedMemories.length === 0 && !featuredMemory ? (
          <div className="text-center py-16 text-hearth-muted">
            <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="font-medium">No memories yet</p>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="btn-primary mt-4 text-sm"
              >
                Add the first memory
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {feedMemories.map(memory => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        )}
      </section>

      {/* Family Album Glimpse */}
      {memories.length > 3 && (
        <section>
          <h2 className="text-lg font-bold text-hearth-text mb-3">Family Album Glimpse</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {memories
              .flatMap(m => m.images ?? [])
              .slice(0, 5)
              .map((img, i) => (
                <div
                  key={i}
                  className={`overflow-hidden rounded-xl ${i === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`}
                >
                  <img
                    src={cloudinaryUrl(img, { width: 300, height: 300 })}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
