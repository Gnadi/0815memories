import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenLine, Plus, Baby } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useAllJournals } from '../hooks/useJournals'
import KidJournalCard from '../components/journal/KidJournalCard'
import AddKidModal from '../components/admin/AddKidModal'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

export default function KidsJournalPage() {
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { kids, loading, addKid, updateKid, deleteKid } = useKids(familyId, encryptionKey)
  const { journals } = useAllJournals(familyId, encryptionKey)
  const [showAddKid, setShowAddKid] = useState(false)
  const [editingKid, setEditingKid] = useState(null)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  const journalCountByKid = journals.reduce((acc, j) => {
    acc[j.childId] = (acc[j.childId] || 0) + 1
    return acc
  }, {})

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-bark mb-2">A Gift for Their Future</h1>
        <p className="text-bark-muted max-w-lg">
          Write letters to your children that they'll only open years from now. Record the small joys,
          the big milestones, and the wisdom you want to share with them when they are grown.
        </p>
        <button
          onClick={() => {
            setEditingKid(null)
            setShowAddKid(true)
          }}
          className="btn-kaydo mt-5 flex items-center gap-2"
        >
          <PenLine className="w-4 h-4" />
          Add New Child
        </button>
      </div>

      {/* Kids grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
        </div>
      ) : kids.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center">
            <Baby className="w-8 h-8 text-bark-muted" />
          </div>
          <div>
            <p className="font-semibold text-bark">No children added yet</p>
            <p className="text-sm text-bark-muted mt-1">Add a child to start writing their journal.</p>
          </div>
          <button
            onClick={() => setShowAddKid(true)}
            className="btn-kaydo flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Child
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {kids.map((kid) => (
            <KidJournalCard
              key={kid.id}
              kid={kid}
              journalCount={journalCountByKid[kid.id] || 0}
              onViewArchive={() => navigate(`/journal/${kid.id}`)}
              onEdit={() => {
                setEditingKid(kid)
                setShowAddKid(true)
              }}
              onDelete={() => {
                if (confirm(`Delete ${kid.name}? This will permanently remove the child and cannot be undone.`)) {
                  deleteKid(kid.id)
                }
              }}
            />
          ))}

          {/* Add another child */}
          <button
            onClick={() => {
              setEditingKid(null)
              setShowAddKid(true)
            }}
            className="bg-warm-white border-2 border-dashed border-cream-darker rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors min-h-[180px]"
          >
            <Plus className="w-8 h-8" />
            <span className="text-sm font-medium">Add Another Child</span>
          </button>
        </div>
      )}

      {showAddKid && (
        <AddKidModal
          kid={editingKid}
          onClose={() => { setShowAddKid(false); setEditingKid(null) }}
          onSave={editingKid ? updateKid : addKid}
        />
      )}
        </div>
      </div>
    </div>
  )
}
