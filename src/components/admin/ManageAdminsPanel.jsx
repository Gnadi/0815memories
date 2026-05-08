import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore'
import { db, auth } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import { Shield, Plus, Trash2, Loader2, Mail, User } from 'lucide-react'

export default function ManageAdminsPanel() {
  const { familyId, user } = useAuth()
  const [ownerUid, setOwnerUid] = useState(null)
  const [adminUids, setAdminUids] = useState([])
  const [adminMeta, setAdminMeta] = useState({}) // uid -> { email, addedBy, addedAt }
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [removingUid, setRemovingUid] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadFamily = useCallback(async () => {
    if (!familyId || !db) return
    const snap = await getDoc(doc(db, 'families', familyId))
    if (!snap.exists()) return
    const data = snap.data()
    setOwnerUid(data.adminUid || null)
    setAdminUids(Array.isArray(data.adminUids)
      ? data.adminUids
      : (data.adminUid ? [data.adminUid] : []))
  }, [familyId])

  useEffect(() => {
    loadFamily()
  }, [loadFamily])

  // Live-subscribe to the admins metadata subcollection so removals/additions
  // reflect in the UI without a manual refresh.
  useEffect(() => {
    if (!familyId || !db) return
    const ref = collection(db, 'families', familyId, 'admins')
    const unsub = onSnapshot(ref, (snap) => {
      const map = {}
      snap.forEach((d) => { map[d.id] = d.data() })
      setAdminMeta(map)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [familyId])

  const callServer = async (path, body) => {
    if (!auth?.currentUser) throw new Error('Not signed in')
    const idToken = await auth.currentUser.getIdToken()
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`)
    }
    return data
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) return setError('Email is required')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')

    setSubmitting(true)
    try {
      await callServer('/api/admin-invite', {
        email: trimmedEmail,
        password,
        familyId,
      })
      setEmail('')
      setPassword('')
      setConfirm('')
      setShowForm(false)
      setNotice(`Added ${trimmedEmail} as a family admin. Share the password with them out-of-band.`)
      await loadFamily()
      setTimeout(() => setNotice(''), 6000)
    } catch (err) {
      setError(err.message || 'Failed to add admin')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (targetUid) => {
    if (!targetUid) return
    const targetEmail = adminMeta[targetUid]?.email || 'this admin'
    if (!window.confirm(`Remove ${targetEmail} from this family? They will no longer be able to log in.`)) return
    setError('')
    setNotice('')
    setRemovingUid(targetUid)
    try {
      await callServer('/api/admin-remove', { targetUid, familyId })
      await loadFamily()
      setNotice('Admin removed.')
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to remove admin')
    } finally {
      setRemovingUid(null)
    }
  }

  const renderAdminRow = (uid) => {
    const isOwner = uid === ownerUid
    const isSelf = uid === user?.uid
    const meta = adminMeta[uid]
    const displayEmail = meta?.email
      || (isSelf ? user?.email : null)
      || (isOwner ? '(family owner)' : `uid: ${uid.slice(0, 8)}…`)
    const canRemove = !isOwner && (!isSelf || adminUids.length > 1)

    return (
      <div
        key={uid}
        className="flex items-center justify-between gap-3 px-4 py-3 bg-cream-dark rounded-xl"
      >
        <div className="flex items-center gap-3 min-w-0">
          <User className="w-4 h-4 text-bark-muted shrink-0" />
          <div className="min-w-0">
            <div className="text-sm text-bark truncate">{displayEmail}</div>
            <div className="text-xs text-bark-muted flex items-center gap-2">
              {isOwner && <span className="px-1.5 py-0.5 bg-kaydo/15 text-kaydo rounded">Owner</span>}
              {isSelf && <span className="px-1.5 py-0.5 bg-bark/10 text-bark rounded">You</span>}
            </div>
          </div>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={() => handleRemove(uid)}
            disabled={removingUid === uid}
            className="text-sm px-3 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {removingUid === uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove
          </button>
        ) : (
          <span className="text-xs text-bark-muted">—</span>
        )}
      </div>
    )
  }

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <label className="block text-sm font-medium text-bark mb-1.5">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4" />
          Manage Admins
        </div>
      </label>
      <p className="text-xs text-bark-muted mb-3">
        Other admins can log in with their own email and password and have full access to this family's data.
        New admins are bound to this family only — they cannot access any other family.
      </p>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 px-4 py-2 rounded-lg mb-3">{error}</p>
      )}
      {notice && (
        <p className="text-sm text-kaydo bg-cream-dark px-4 py-2 rounded-lg mb-3">{notice}</p>
      )}

      <div className="space-y-2 mb-3">
        {loading && adminUids.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-bark-muted px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading admins…
          </div>
        ) : (
          adminUids.map(renderAdminRow)
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-2 p-3 bg-cream-dark rounded-xl">
          <label className="block text-sm font-medium text-bark">
            <div className="flex items-center gap-1.5 mb-1">
              <Mail className="w-4 h-4" /> Email
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new-admin@example.com"
              className="w-full px-4 py-2.5 bg-warm-white rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              autoComplete="off"
              required
            />
          </label>
          <label className="block text-sm font-medium text-bark">
            <div className="mb-1">Initial password (min 8 characters)</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-warm-white rounded-xl text-bark text-base outline-none focus:ring-2 focus:ring-kaydo/30"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="block text-sm font-medium text-bark">
            <div className="mb-1">Confirm password</div>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 bg-warm-white rounded-xl text-bark text-base outline-none focus:ring-2 focus:ring-kaydo/30"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add admin
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); setEmail(''); setPassword(''); setConfirm('') }}
              disabled={submitting}
              className="text-sm px-4 py-2 rounded-xl text-bark-muted hover:bg-cream-dark"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
        >
          <Plus className="w-4 h-4" />
          Add admin
        </button>
      )}
    </div>
  )
}
