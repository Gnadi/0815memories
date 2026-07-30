import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { Check, Copy, Loader2, UserPlus, X } from 'lucide-react'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { devError } from '../utils/devLog'
import { buildInviteUrl, generateInviteToken, INVITE_TTL_MS } from '../utils/inviteToken'
import { participantName } from '../utils/ourYear'
import { useOurYearRitual } from '../hooks/useOurYear'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

const OCCASIONS = ['anniversary', 'wedding', 'firstMet', 'newYear', 'personal', 'custom']
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * First run — and later, changes to the ritual.
 *
 * Nothing here presumes a particular life: no relationship date is required, no
 * wedding, no children. The only hard requirement is two accounts, because
 * "answer independently" has to mean something.
 */
export default function OurYearSetupPage() {
  const { t, i18n } = useTranslation('ourYear')
  const { isAdmin, familyId, user, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? null
  const { ritual, loading, createRitual, updateRitual } = useOurYearRitual(familyId, uid, encryptionKey)

  const [admins, setAdmins] = useState([])
  const [ownName, setOwnName] = useState('')
  const [partnerUid, setPartnerUid] = useState('')
  const [partnerNameValue, setPartnerNameValue] = useState('')
  const [occasionKey, setOccasionKey] = useState('anniversary')
  const [occasionLabel, setOccasionLabel] = useState('')
  const [rhythm, setRhythm] = useState('recurring')
  const [anchorDay, setAnchorDay] = useState(1)
  const [anchorMonth, setAnchorMonth] = useState(1)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  // The other admin accounts of this family — the pool the partner comes from.
  useEffect(() => {
    if (!familyId || !db) return
    const unsubscribe = onSnapshot(
      collection(db, 'families', familyId, 'admins'),
      (snapshot) => {
        setAdmins(
          snapshot.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((a) => a.uid !== uid),
        )
      },
      (err) => devError('Failed to load family admins:', err),
    )
    return unsubscribe
  }, [familyId, uid])

  // Editing an existing ritual: take its values once.
  useEffect(() => {
    if (hydrated || loading) return
    if (ritual) {
      const otherUid = (ritual.participantUids ?? []).find((u) => u !== uid) ?? ''
      setOwnName(participantName(ritual, uid))
      setPartnerUid(otherUid)
      setPartnerNameValue(participantName(ritual, otherUid))
      setOccasionKey(ritual.occasionKey ?? 'anniversary')
      setOccasionLabel(ritual.occasionLabel ?? '')
      setRhythm(ritual.rhythm ?? 'recurring')
      setAnchorDay(ritual.anchorDay ?? 1)
      setAnchorMonth(ritual.anchorMonth ?? 1)
    } else {
      setOwnName(user?.displayName ?? '')
    }
    setHydrated(true)
  }, [ritual, loading, hydrated, uid, user])

  const handleInvite = useCallback(async () => {
    setError('')
    setInviting(true)
    try {
      const token = generateInviteToken()
      await setDoc(doc(db, 'families', familyId, 'invites', token), {
        createdBy: uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
        used: false,
        redeemedBy: null,
        redeemedAt: null,
      })
      setInviteLink(buildInviteUrl(familyId, token))
    } catch (err) {
      devError('Our Year invite failed:', err)
      setError(t('errors.inviteFailed'))
    } finally {
      setInviting(false)
    }
  }, [familyId, uid, t])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the link is on screen and selectable */
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!partnerUid) {
      setError(t('errors.partnerRequired'))
      return
    }
    if (!ownName.trim() || !partnerNameValue.trim()) {
      setError(t('errors.namesRequired'))
      return
    }
    if (occasionKey === 'custom' && !occasionLabel.trim()) {
      setError(t('errors.customLabelRequired'))
      return
    }

    const payload = {
      participantUids: [uid, partnerUid],
      partners: [
        { uid, name: ownName.trim() },
        { uid: partnerUid, name: partnerNameValue.trim() },
      ],
      occasionKey,
      occasionLabel: occasionKey === 'custom' ? occasionLabel.trim() : '',
      rhythm,
      anchorMonth: rhythm === 'recurring' ? Number(anchorMonth) : null,
      anchorDay: rhythm === 'recurring' ? Number(anchorDay) : null,
    }

    setSaving(true)
    try {
      if (ritual) {
        // participantUids are immutable once the ritual exists — the rules
        // reject any attempt to hand the ritual to someone else.
        const { participantUids, ...editable } = payload
        void participantUids
        await updateRitual(ritual.id, editable)
      } else {
        await createRitual(payload)
      }
      navigate('/our-year')
    } catch (err) {
      devError('Our Year setup failed:', err)
      setError(t('errors.saveFailed'))
      setSaving(false)
    }
  }

  if (!isAdmin) return null

  const editing = !!ritual
  const monthName = (month) =>
    new Date(2024, month - 1, 1).toLocaleDateString(i18n.language || 'de', { month: 'long' })

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        <div className="lg:hidden sticky top-0 z-10 bg-cream border-b border-cream-dark px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-bold text-bark">
            {editing ? t('setup.editTitle') : t('setup.headerTitle')}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/our-year')}
            aria-label={t('setup.cancel')}
            className="text-bark-muted hover:text-bark p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 lg:py-10 space-y-6">
            <div className="hidden lg:block">
              <h1 className="font-serif text-3xl font-bold text-bark leading-tight">
                {editing ? t('setup.editTitle') : t('setup.headerTitle')}
              </h1>
              <p className="text-sm text-bark-muted mt-1">{t('setup.subtitle')}</p>
            </div>

            {!editing && (
              <p className="text-sm text-bark-light bg-warm-white rounded-2xl p-4 shadow-sm">
                {t('setup.intro')}
              </p>
            )}

            {/* Who --------------------------------------------------------- */}
            <section className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-xs font-bold text-kaydo uppercase tracking-wide">
                {t('setup.step1Label')}
              </p>

              <div>
                <label htmlFor="ouryear-own-name" className="block text-sm font-medium text-bark mb-1">
                  {t('partner.yourNameLabel')}
                </label>
                <input
                  id="ouryear-own-name"
                  value={ownName}
                  onChange={(e) => setOwnName(e.target.value)}
                  placeholder={t('partner.yourNamePlaceholder')}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                />
              </div>

              {admins.length === 0 ? (
                <div className="bg-cream rounded-xl p-4">
                  <p className="font-semibold text-bark text-sm">{t('setup.noPartnerHeading')}</p>
                  <p className="text-sm text-bark-muted mt-1">{t('setup.noPartnerBody')}</p>

                  {inviteLink ? (
                    <div className="mt-3">
                      <p className="text-xs text-bark-muted break-all bg-warm-white rounded-lg p-2.5">
                        {inviteLink}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="mt-2 flex items-center gap-1.5 text-sm text-kaydo font-semibold hover:underline"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? t('setup.inviteCopied') : t('setup.inviteCopy')}
                      </button>
                      <p className="text-xs text-bark-muted mt-2">{t('setup.inviteHint')}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInvite}
                      disabled={inviting}
                      className="mt-3 flex items-center gap-2 bg-bark text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-50"
                    >
                      {inviting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      {inviting ? t('setup.inviteCreating') : t('setup.inviteCta')}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="ouryear-partner" className="block text-sm font-medium text-bark mb-1">
                      {t('setup.partnerSelectLabel')}
                    </label>
                    <select
                      id="ouryear-partner"
                      value={partnerUid}
                      onChange={(e) => setPartnerUid(e.target.value)}
                      disabled={editing}
                      className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30 disabled:opacity-60"
                    >
                      <option value="">{t('setup.partnerSelectPlaceholder')}</option>
                      {admins.map((admin) => (
                        <option key={admin.uid} value={admin.uid}>
                          {admin.email || admin.uid}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-bark-muted mt-1.5">{t('setup.partnerSelectHint')}</p>
                  </div>

                  <div>
                    <label
                      htmlFor="ouryear-partner-name"
                      className="block text-sm font-medium text-bark mb-1"
                    >
                      {t('partner.partnerNameLabel')}
                    </label>
                    <input
                      id="ouryear-partner-name"
                      value={partnerNameValue}
                      onChange={(e) => setPartnerNameValue(e.target.value)}
                      placeholder={t('partner.partnerNamePlaceholder')}
                      className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                    />
                  </div>
                </>
              )}
            </section>

            {/* Occasion ---------------------------------------------------- */}
            <section className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-3">
              <p className="text-xs font-bold text-kaydo uppercase tracking-wide">
                {t('setup.step2Label')}
              </p>
              <p className="text-sm font-medium text-bark">{t('setup.occasionLabel')}</p>

              <div className="space-y-2">
                {OCCASIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOccasionKey(key)}
                    className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                      occasionKey === key
                        ? 'border-kaydo bg-cream'
                        : 'border-transparent bg-cream/50 hover:bg-cream'
                    }`}
                  >
                    <span className="text-sm text-bark">{t(`occasions.${key}`)}</span>
                  </button>
                ))}
              </div>

              {occasionKey === 'custom' && (
                <div>
                  <label
                    htmlFor="ouryear-custom-label"
                    className="block text-sm font-medium text-bark mb-1"
                  >
                    {t('setup.customLabelLabel')}
                  </label>
                  <input
                    id="ouryear-custom-label"
                    value={occasionLabel}
                    onChange={(e) => setOccasionLabel(e.target.value)}
                    placeholder={t('setup.customLabelPlaceholder')}
                    className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                  />
                </div>
              )}

              <p className="text-xs text-bark-muted">{t('setup.occasionHint')}</p>
            </section>

            {/* Rhythm ------------------------------------------------------ */}
            <section className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-3">
              <p className="text-xs font-bold text-kaydo uppercase tracking-wide">
                {t('setup.step3Label')}
              </p>

              <button
                type="button"
                onClick={() => setRhythm('recurring')}
                className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                  rhythm === 'recurring'
                    ? 'border-kaydo bg-cream'
                    : 'border-transparent bg-cream/50 hover:bg-cream'
                }`}
              >
                <span className="block text-sm font-medium text-bark">
                  {t('setup.rhythmRecurring')}
                </span>
                <span className="block text-xs text-bark-muted mt-0.5">
                  {t('setup.rhythmRecurringHint')}
                </span>
              </button>

              {rhythm === 'recurring' && (
                <div className="grid grid-cols-2 gap-3 pl-1">
                  <label className="block">
                    <span className="block text-xs text-bark-muted mb-1">{t('setup.dayLabel')}</span>
                    <select
                      value={anchorDay}
                      onChange={(e) => setAnchorDay(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs text-bark-muted mb-1">{t('setup.monthLabel')}</span>
                    <select
                      value={anchorMonth}
                      onChange={(e) => setAnchorMonth(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {monthName(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={() => setRhythm('manual')}
                className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                  rhythm === 'manual'
                    ? 'border-kaydo bg-cream'
                    : 'border-transparent bg-cream/50 hover:bg-cream'
                }`}
              >
                <span className="block text-sm font-medium text-bark">{t('setup.rhythmManual')}</span>
                <span className="block text-xs text-bark-muted mt-0.5">
                  {t('setup.rhythmManualHint')}
                </span>
              </button>
            </section>

            <p className="text-xs text-bark-muted">{t('privacy.note')}</p>

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? t('setup.saving') : editing ? t('setup.editSave') : t('setup.save')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
