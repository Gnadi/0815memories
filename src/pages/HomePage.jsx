import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import DailyMoments from '../components/home/DailyMoments'
import MomentViewer from '../components/home/MomentViewer'
import FeaturedJourney from '../components/home/FeaturedJourney'
import MemoryFeed from '../components/home/MemoryFeed'
import AlbumGlimpse from '../components/home/AlbumGlimpse'
import PostMemoryModal from '../components/admin/PostMemoryModal'
import PostMomentModal from '../components/admin/PostMomentModal'
import { useMemories, useMoments } from '../hooks/useMemories'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const navigate = useNavigate()
  const [showPostModal, setShowPostModal] = useState(false)
  const [editingMemory, setEditingMemory] = useState(null)
  const [viewingMomentIndex, setViewingMomentIndex] = useState(null)
  const [showMomentModal, setShowMomentModal] = useState(false)
  const [editingMoment, setEditingMoment] = useState(null)
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const { memories, featuredMemory, loading, addMemory, updateMemory, deleteMemory } = useMemories(familyId, encryptionKey)
  const { moments, addMoment, updateMoment, deleteMoment } = useMoments(familyId)

  const nonFeaturedMemories = memories.filter((m) => !m.featured)

  const handleEdit = (memory) => {
    setEditingMemory(memory)
    setShowPostModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this memory?')) {
      await deleteMemory(id)
    }
  }

  const handleCloseModal = () => {
    setShowPostModal(false)
    setEditingMemory(null)
  }

  const handleEditMoment = (moment) => {
    setEditingMoment(moment)
    setShowMomentModal(true)
  }

  const handleDeleteMoment = async (id) => {
    await deleteMoment(id)
  }

  const handleCloseMomentModal = () => {
    setShowMomentModal(false)
    setEditingMoment(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-kaydo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar onPostMemory={() => setShowPostModal(true)} />

      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-3xl mx-auto w-full">
          <DailyMoments
            moments={moments}
            onAddMoment={() => setShowMomentModal(true)}
            onMomentClick={(index) => setViewingMomentIndex(index)}
            onViewAll={() => navigate('/moments')}
          />
          <FeaturedJourney memory={featuredMemory} />
          <MemoryFeed
            memories={nonFeaturedMemories}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          <AlbumGlimpse memories={memories} />

          {/* Smart Timeline CTA */}
          <Link
            to="/timeline"
            className="block mt-6 rounded-2xl overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #A04420 0%, #C25A2E 60%, #D4784A 100%)' }}
          >
            <div className="px-6 py-7 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest text-white/70 uppercase mb-1">Explore</p>
                <h3 className="font-serif text-xl font-bold text-white leading-snug">
                  Travel back in time
                </h3>
                <p className="text-sm text-white/80 mt-1 leading-relaxed max-w-[220px]">
                  Browse every memory by year and season.
                </p>
              </div>
              <div className="flex-shrink-0 ml-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </main>
      </div>

      {/* Post Memory Modal */}
      {showPostModal && (
        <PostMemoryModal
          memory={editingMemory}
          onClose={handleCloseModal}
          onSave={editingMemory ? updateMemory : addMemory}
        />
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

      {/* Post Moment Modal (admin only) */}
      {showMomentModal && (
        <PostMomentModal
          moment={editingMoment}
          onClose={handleCloseMomentModal}
          onSave={editingMoment ? updateMoment : addMoment}
        />
      )}
    </div>
  )
}
