import { useState, useEffect, useCallback } from 'react'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where,
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import { Shield, Plus, Trash2, Loader2, User, Copy, Check, Link as LinkIcon } from 'lucide-react'
import { generateInviteToken, INVITE_TTL_MS, buildInviteUrl } from '../../utils/inviteToken'

export default function ManageAdminsPanel() {
  const { familyId, user } = useAuth()
  const [ownerUid, setOwnerUid] = useState(null)
  const [adminUids, setAdminUids] = useState([])
  const [adminMeta, setAdminMeta] = useState({})
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [removingUid, setRemovingUid] = useState(null)
  const [revokingToken, setRevokingToken] = useState(null)
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

  // Live list of unredeemed, unexpired invites.
  useEffect(() => {
    if (!familyId || !db) return
    const ref = collection(db, 'families', familyId, 'invites')
    const q = query(ref, where('used', '==', false))
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now()
      const rows = []
      snap.forEach((d) => {
        const data = d.data()
        const expiresAt = data.expiresAt?.toMillis?.() ?? 0
        if (expiresAt > now) {
          rows.push({ id: d.id, ...data, expiresAtMs: expiresAt })
        }
      })
      rows.sort((a, b) => b.expiresAtMs - a.expiresAtMs)
      setPendingInvites(rows)
    })
    return unsub
  }, [familyId])

  const handleGenerate = async () => {
    setError('')
    setNotice('')
    setGeneratedLink('')
    setCopied(false)
    if (!familyId || !user) return
    setGenerating(true)
    try {
      const token = generateInviteToken()
      const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS)
      await setDoc(doc(db, 'families', familyId, 'invites', token), {
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
        redeemedBy: null,
        redeemedAt: null,
      })
      setGeneratedLink(buildInviteUrl(familyId, token))
    } catch (err) {
      setError(err.message || 'Failed to generate invite link')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRevoke = async (token) => {
    if (!token) return
    if (!window.confirm('Revoke this invite link? It can no longer be used.')) return
    setError('')
    setNotice('')
    setRevokingToken(token)
    try {
      await deleteDoc(doc(db, 'families', familyId, 'invites', token))
      setNotice('Invite revoked.')
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to revoke invite')
    } finally {
      setRevokingToken(null)
    }
  }

  const handleRemove = async (targetUid) => {
    if (!targetUid) return
    const targetEmail = adminMeta[targetUid]?.email || 'this admin'
    if (!window.confirm(`Remove ${targetEmail} from this family? They will no longer be able to sign in here.`)) return
    setError('')
    setNotice('')
    setRemovingUid(targetUid)
    try {
      // Two client-side writes; the rules enforce ownership preservation
      // (Path D: owner stays in the array; non-admins cannot mutate adminUids).
      await deleteDoc(doc(db, 'families', familyId, 'admins', targetUid))
      await updateDoc(doc(db, 'families', familyId), {
        adminUids: arrayRemove(targetUid),
      })
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

  const formatExpiry = (ms) => {
    const days = Math.max(0, Math.round((ms - Date.now()) / (24 * 60 * 60 * 1000)))
    if (days === 0) return 'expires today'
    if (days === 1) return 'expires in 1 day'
    return `expires in ${days} days`
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
        Generate a one-time invite link to add another admin. They'll set their own password.
        Each admin is bound to this family only.
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

      {generatedLink ? (
        <div className="p-3 bg-cream-dark rounded-xl space-y-2 mb-3">
          <p className="text-xs text-bark-muted">
            Share this link with the new admin. It is valid for 7 days and can only be used once.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={generatedLink}
              readOnly
              className="flex-1 min-w-0 px-4 py-2.5 bg-warm-white rounded-xl text-bark text-sm outline-none select-all"
            />
            <button
              type="button"
              onClick={() => handleCopy(generatedLink)}
              className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Generate invite link
      </button>

      {pendingInvites.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-bark mb-2">Pending invites</p>
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const url = buildInviteUrl(familyId, invite.id)
              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-cream-dark rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LinkIcon className="w-4 h-4 text-bark-muted shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-bark truncate font-mono">{url}</div>
                      <div className="text-xs text-bark-muted">{formatExpiry(invite.expiresAtMs)}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(url)}
                      className="text-sm px-2.5 py-1.5 rounded-lg text-bark hover:bg-warm-white"
                      title="Copy link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(invite.id)}
                      disabled={revokingToken === invite.id}
                      className="text-sm px-2.5 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      title="Revoke"
                    >
                      {revokingToken === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
