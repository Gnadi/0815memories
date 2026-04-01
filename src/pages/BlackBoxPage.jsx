import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBlackBox } from '../hooks/useBlackBox'
import { useKids } from '../hooks/useKids'
import BlackBoxCard from '../components/blackbox/BlackBoxCard'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

export default function BlackBoxPage() {
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const { boxes, loading, deleteBox } = useBlackBox(familyId)
  const { kids } = useKids(familyId)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const kidMap = Object.fromEntries(kids.map((k) => [k.id, k]))

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <MobileHeader />
        <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-bark flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-bark">The Black Box</h1>
        </div>
        <p className="text-bark-muted max-w-lg">
          A scheduled emotional delivery system. Seal a message today — it will only unlock on the
          exact day you choose: a birthday, a wedding, a graduation, or whenever the time is right.
        </p>
        <button
          onClick={() => navigate('/blackbox/new')}
          className="mt-5 flex items-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Preserve a Moment
        </button>
      </div>

      {/* Boxes */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-hearth border-t-transparent rounded-full animate-spin" />
        </div>
      ) : boxes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-bark/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-bark-muted" />
          </div>
          <div>
            <p className="font-semibold text-bark">No sealed messages yet</p>
            <p className="text-sm text-bark-muted mt-1">
              Create your first time-release message — a gift for the future.
            </p>
          </div>
          <button
            onClick={() => navigate('/blackbox/new')}
            className="flex items-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Seal Your First Message
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {boxes.map((box) => (
            <BlackBoxCard
              key={box.id}
              box={box}
              kidName={box.childId ? kidMap[box.childId]?.name : null}
              onDelete={() => {
                if (confirm('Delete this sealed message permanently? This cannot be undone.')) {
                  deleteBox(box.id)
                }
              }}
            />
          ))}
        </div>
      )}

        </div>
      </div>
    </div>
  )
}
