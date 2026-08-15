import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { ArrowLeft, Share2, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import MemoryHero from '../components/memory/MemoryHero'
import MemoryBody from '../components/memory/MemoryBody'
import PostMemoryModal from '../components/admin/PostMemoryModal'
import { useAuth } from '../context/AuthContext'
import { useMemoryWriter, decryptMemoryDoc } from '../hooks/useMemories'
import { parseRichDoc } from '../utils/richText'

export default function MemoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('memory')
  const { familyId, isAdmin, encryptionKey } = useAuth()
  // Writes go through the shared writer so there is exactly one place in the app
  // that encrypts a memory.
  const { updateMemory, deleteMemory } = useMemoryWriter(familyId, encryptionKey)
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    async function fetchMemory() {
      const docSnap = await getDoc(doc(db, 'memories', id))
      if (docSnap.exists()) {
        const data = docSnap.data()
        // Only show memory if it belongs to the current family
        if (data.familyId === familyId) {
          const decrypted = await decryptMemoryDoc(encryptionKey, data)
          setMemory({ id: docSnap.id, ...decrypted })
        }
      }
      setLoading(false)
    }
    fetchMemory()
  }, [id, familyId, encryptionKey])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleEdit = () => {
    setShowMenu(false)
    setShowEditModal(true)
  }

  const handleDelete = async () => {
    setShowMenu(false)
    if (!window.confirm(t('detail.deleteConfirm'))) return
    await deleteMemory(id)
    navigate('/home')
  }

  const handleSaveEdit = async (memId, updates) => {
    await updateMemory(memId, updates)
    // `updates.contentRich` is the JSON string that was persisted; this view
    // renders from the parsed document.
    setMemory((prev) => ({
      ...prev,
      ...updates,
      ...(updates.contentRich != null ? { contentRich: parseRichDoc(updates.contentRich) } : {}),
    }))
    setShowEditModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-kaydo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <p className="text-bark-light text-lg">{t('detail.notFound')}</p>
        <button
          onClick={() => navigate('/home')}
          className="btn-kaydo"
        >
          {t('detail.backToHome')}
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
    <div className="min-h-screen bg-cream pb-20 lg:pb-0">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-cream/80 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-bark hover:text-kaydo transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Kaydo</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={handleShare} className="text-bark-light hover:text-kaydo">
            <Share2 className="w-5 h-5" />
          </button>
          {isAdmin && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="text-bark-light hover:text-kaydo"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg py-2 z-10 min-w-[140px]">
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark hover:bg-cream-dark"
                  >
                    <Pencil className="w-4 h-4" /> {t('detail.edit')}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" /> {t('detail.delete')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4">
        <MemoryHero
          images={memory.images}
          imageUrl={memory.imageUrl}
          thumbs={memory.thumbs}
          category={memory.category}
        />
        <MemoryBody memory={memory} />
      </div>

      {showEditModal && (
        <PostMemoryModal
          memory={memory}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}
