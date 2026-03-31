import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Plus } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()
  const [showPostModal, setShowPostModal] = useState(false)
  const [editingMemory, setEditingMemory] = useState(null)
  const [viewingMomentIndex, setViewingMomentIndex] = useState(null)
  const [showMomentModal, setShowMomentModal] = useState(false)
  const [editingMoment, setEditingMoment] = useState(null)
  const { isAdmin, familyId } = useAuth()
  const { memories, featuredMemory, loading, addMemory, updateMemory, deleteMemory } = useMemories(familyId)
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
        <div className="w-10 h-10 border-4 border-hearth border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar onPostMemory={() => setShowPostModal(true)} />

      <div className="flex-1 flex flex-col min-h-screen">
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
        </main>
      </div>

      {/* Floating action button (mobile, admin only) */}
      {isAdmin && (
        <button
          onClick={() => setShowPostModal(true)}
          className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-hearth text-white rounded-full shadow-lg flex items-center justify-center hover:bg-hearth-dark transition-colors z-20"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

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
