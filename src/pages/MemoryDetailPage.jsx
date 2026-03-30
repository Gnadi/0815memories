import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { ArrowLeft, Share2, MoreVertical } from 'lucide-react'
import MemoryHero from '../components/memory/MemoryHero'
import MemoryBody from '../components/memory/MemoryBody'
import { useAuth } from '../context/AuthContext'

export default function MemoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { familyId } = useAuth()
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMemory() {
      const docSnap = await getDoc(doc(db, 'memories', id))
      if (docSnap.exists()) {
        const data = docSnap.data()
        // Only show memory if it belongs to the current family
        if (data.familyId === familyId) {
          setMemory({ id: docSnap.id, ...data })
        }
      }
      setLoading(false)
    }
    fetchMemory()
  }, [id, familyId])

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-hearth border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <p className="text-bark-light text-lg">Memory not found</p>
        <button
          onClick={() => navigate('/home')}
          className="btn-hearth"
        >
          Back to Home
        </button>
      </div>
    )
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: memory.title,
        text: memory.content?.slice(0, 100),
        url: window.location.href,
      })
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-cream/80 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-bark hover:text-hearth transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Family Hearth</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={handleShare} className="text-bark-light hover:text-hearth">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="text-bark-light hover:text-hearth">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4">
        <MemoryHero imageUrl={memory.imageUrl} category={memory.category} />
        <MemoryBody memory={memory} />
      </div>
    </div>
  )
}
