import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Camera } from 'lucide-react'
import { useAllMoments } from '../hooks/useMemories'
import { useAuth } from '../context/AuthContext'
import MomentViewer from '../components/home/MomentViewer'
import PostMomentModal from '../components/admin/PostMomentModal'
import { formatRelativeDate } from '../utils/helpers'

export default function MomentsAllPage() {
  const navigate = useNavigate()
  const { familyId, isAdmin } = useAuth()
  const { moments, loading, updateMoment, deleteMoment } = useAllMoments(familyId)
  const [viewingMomentIndex, setViewingMomentIndex] = useState(null)
  const [editingMoment, setEditingMoment] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const handleEditMoment = (moment) => {
    setEditingMoment(moment)
    setShowEditModal(true)
  }

  const handleDeleteMoment = async (id) => {
    await deleteMoment(id)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingMoment(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-hearth border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream border-b border-cream-dark px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-cream-dark transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-bark" />
        </button>
        <h1 className="text-lg font-bold text-bark">Daily Moments</h1>
      </div>

      {/* Grid */}
      {moments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-bark-muted">
          <Camera className="w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">No moments yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
          {moments.map((moment, index) => (
            <button
              key={moment.id}
              onClick={() => setViewingMomentIndex(index)}
              className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-cream-dark group"
            >
              {moment.images?.[0] ? (
                <img
                  src={moment.images[0]}
                  alt={moment.caption}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-bark-muted opacity-40" />
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              {/* Bottom label */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 pointer-events-none">
                {moment.caption && (
                  <p className="text-white text-xs leading-snug line-clamp-2 mb-0.5 font-medium drop-shadow">
                    {moment.caption}
                  </p>
                )}
                <p className="text-white/70 text-[10px] font-medium drop-shadow">
                  {moment.label || formatRelativeDate(moment.date)}
                </p>
              </div>

            </button>
          ))}
        </div>
      )}

      {/* Moment Viewer */}
      {viewingMomentIndex !== null && moments.length > 0 && (
        <MomentViewer
          moments={moments}
          initialIndex={viewingMomentIndex}
          onClose={() => setViewingMomentIndex(null)}
          isAdmin={isAdmin}
          onEdit={handleEditMoment}
          onDelete={handleDeleteMoment}
        />
      )}

      {/* Edit Moment Modal */}
      {showEditModal && (
        <PostMomentModal
          moment={editingMoment}
          onClose={handleCloseEditModal}
          onSave={updateMoment}
        />
      )}
    </div>
  )
}
