import { Calendar, MapPin } from 'lucide-react'
import { formatDate } from '../../utils/helpers'
import VoiceMemoPlayer from './VoiceMemoPlayer'
import MemoryVideoPlayer from './MemoryVideoPlayer'
import RichContent from './RichContent'
import { isRichDoc } from '../../utils/richText'

export default function MemoryBody({ memory }) {
  return (
    <article className="max-w-2xl mx-auto px-4 pt-10 pb-16">
      {/* Badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        {memory.date && (
          <span className="flex items-center gap-1.5 text-sm text-bark-light bg-cream-dark px-3 py-1.5 rounded-full">
            <Calendar className="w-4 h-4" />
            {formatDate(memory.date)}
          </span>
        )}
        {memory.location && (
          <span className="flex items-center gap-1.5 text-sm text-bark-light bg-cream-dark px-3 py-1.5 rounded-full">
            <MapPin className="w-4 h-4 text-kaydo" />
            {memory.location}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-4xl lg:text-5xl font-bold text-bark font-serif leading-tight mb-6">
        {memory.title}
      </h1>

      {/* Quote */}
      {memory.quote && (
        <blockquote className="border-l-4 border-kaydo pl-5 mb-8 italic text-bark-light text-xl leading-relaxed">
          &ldquo;{memory.quote}&rdquo;
        </blockquote>
      )}

      {/* Body — the rich description when there is one, else the legacy text.
          `contentRich` is only a parsed document on single-document reads; the
          feed leaves it as ciphertext, and memories written before this feature
          have no such field at all. Both fall back to the plain-text mirror. */}
      {isRichDoc(memory.contentRich) ? (
        <RichContent doc={memory.contentRich} />
      ) : (
        memory.content && (
          <div className="text-bark-light text-lg leading-relaxed space-y-4">
            {memory.content.split('\n\n').map((paragraph, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        )
      )}

      {/* Voice Memos */}
      <VoiceMemoPlayer voiceMemos={memory.voiceMemos} />

      {/* Videos */}
      <MemoryVideoPlayer videos={memory.videos} />

      {/* Author */}
      {memory.authorName && (
        <div className="mt-8 pt-6 border-t border-cream-dark">
          <p className="text-sm text-bark-muted">
            Shared by <span className="font-medium text-bark">{memory.authorName}</span>
          </p>
        </div>
      )}
    </article>
  )
}
