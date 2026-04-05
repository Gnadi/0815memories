import { BookOpen, Trash2, Edit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EncryptedImage from '../media/EncryptedImage'

export default function ScrapbookCard({ scrapbook, onDelete }) {
  const navigate = useNavigate()
  const pageCount = scrapbook.pages?.length || 0
  const coverUrl = scrapbook.coverImageUrl || null

  const handleDelete = (e) => {
    e.stopPropagation()
    if (confirm(`Delete "${scrapbook.title}"? This cannot be undone.`)) {
      onDelete(scrapbook.id)
    }
  }

  return (
    <div
      onClick={() => navigate(`/scrapbook/${scrapbook.id}`)}
      className="group relative bg-warm-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-cream-dark"
    >
      {/* Cover image or placeholder */}
      <div className="aspect-[4/3] relative overflow-hidden bg-cream">
        {coverUrl ? (
          <EncryptedImage
            src={coverUrl}
            alt={scrapbook.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-bark-muted opacity-40" />
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-bark/0 group-hover:bg-bark/10 transition-colors" />
        {/* Edit badge */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/90 rounded-lg p-1.5 shadow">
            <Edit2 className="w-4 h-4 text-bark" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-bark text-sm truncate">{scrapbook.title}</h3>
          <p className="text-xs text-bark-muted mt-0.5">
            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="flex-shrink-0 p-1.5 text-bark-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
