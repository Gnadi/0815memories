import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, BookOpen, Camera, ChefHat, Film, Image as ImageIcon, LayoutGrid, Lock, RotateCcw, Trash2, User,
  BookImage,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTrash } from '../hooks/useTrash'
import { deleteForever, restoreFromTrash, TRASH_DAYS } from '../services/trash'
import { devError } from '../utils/devLog'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

const ICONS = {
  memories: ImageIcon,
  moments: Camera,
  journals: BookOpen,
  children: User,
  recipes: ChefHat,
  scrapbooks: BookImage,
  collages: LayoutGrid,
  highlights: Film,
  blackbox: Lock,
}

function TrashItem({ group, onRestore, onDelete, busy }) {
  const { t, i18n } = useTranslation('settings')
  const Icon = ICONS[group.collection] ?? Trash2
  const day = (date) => date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <li className="bg-warm-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-cream-dark flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-bark-muted" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-kaydo uppercase tracking-wide">
            {t(`trash.kinds.${group.collection}`)}
          </p>
          <p className="font-semibold text-bark truncate">{group.title || t('trash.untitled')}</p>
          {group.more > 0 && (
            <p className="text-xs text-bark-muted">{t(`trash.more.${group.collection}`, { count: group.more })}</p>
          )}
          <p className="text-xs text-bark-muted mt-0.5">
            {t('trash.deletedOn', { date: day(group.deletedAt) })} · {t('trash.purgedOn', { date: day(group.purgeAt) })}
          </p>
        </div>
      </div>
      <div className="flex gap-2 sm:flex-shrink-0">
        <button
          type="button"
          onClick={() => onRestore(group)}
          disabled={busy}
          className="btn-kaydo flex items-center gap-1.5 text-sm px-4 disabled:opacity-60"
        >
          <RotateCcw className="w-4 h-4" />
          {t('trash.restore')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(group)}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          <Trash2 className="w-4 h-4" />
          {t('trash.deleteForever')}
        </button>
      </div>
    </li>
  )
}

/**
 * What the family deleted in the last TRASH_DAYS days, to restore or to
 * delete for good — with its photos and videos, which the server deletes.
 */
export default function TrashPage() {
  const { familyId, encryptionKey } = useAuth()
  const { t } = useTranslation('settings')
  const { groups, loading, error } = useTrash(familyId, encryptionKey)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')

  const act = async (group, action, failed) => {
    setBusy(group.id)
    setMessage('')
    try {
      await action(group)
    } catch (err) {
      devError('Trash action failed:', err)
      setMessage(t(failed))
    } finally {
      setBusy(null)
    }
  }

  const handleRestore = (group) => act(group, restoreFromTrash, 'trash.restoreFailed')
  const handleDelete = (group) => {
    if (!window.confirm(t('trash.deleteForeverConfirm', { title: group.title || t('trash.untitled') }))) return
    act(group, deleteForever, 'trash.deleteFailed')
  }

  return (
    <div className="min-h-screen bg-cream flex overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-3xl mx-auto w-full">
          <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-bark-muted hover:text-bark mb-4">
            <ArrowLeft className="w-4 h-4" />
            {t('trash.back')}
          </Link>
          <h1 className="text-2xl font-bold text-bark mb-1">{t('trash.title')}</h1>
          <p className="text-sm text-bark-muted mb-6">{t('trash.description', { days: TRASH_DAYS })}</p>

          {message && <p role="alert" className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg mb-4">{message}</p>}

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-cream-dark animate-pulse" />)}
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{t('trash.loadFailed')}</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-16">
              <Trash2 className="w-10 h-10 text-bark-muted mx-auto mb-3 opacity-50" />
              <p className="text-bark-muted">{t('trash.empty')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {groups.map((group) => (
                <TrashItem
                  key={group.id}
                  group={group}
                  busy={busy === group.id}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}
