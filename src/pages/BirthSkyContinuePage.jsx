import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Lock, Sparkles } from 'lucide-react'
import { Timestamp } from '../config/firestore'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { clearSkyDraft, loadSkyDraft } from '../utils/sky/skyDraft'
import { formatWallDate } from '../utils/sky/caption'
import { devError } from '../utils/devLog'

const NEW_CHILD = 'new'

/**
 * Where a birth sky made on the public page (PublicBirthSkyPage) joins the
 * family, once there is an account and a family to join.
 *
 * The child is added with the birth details — name, time and place encrypted
 * like every child's (services/kids.js) — or, if they are in the family
 * already, the time, place and style go onto their record. Then the draft is
 * deleted from the browser and the birth sky opens, ready to order.
 */
export default function BirthSkyContinuePage() {
  const { t, i18n } = useTranslation('sky')
  const lang = i18n.language?.startsWith('de') ? 'de' : 'en'
  const navigate = useNavigate()
  const { familyId, encryptionKey } = useAuth()
  const { kids, loading, addKid, updateKid } = useKids(familyId, encryptionKey)
  // Read once: the draft is gone the moment it has been taken over.
  const [draft] = useState(() => loadSkyDraft())
  const [target, setTarget] = useState(NEW_CHILD)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  if (!draft) return <Navigate to="/journal" replace />

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-kaydo" />
      </div>
    )
  }

  const handleContinue = async () => {
    setSaving(true)
    setError(false)
    try {
      const details = {
        birthTime: draft.birthTime || null,
        birthPlace: draft.birthPlace,
        skyStyle: draft.skyStyle,
      }
      let childId = target
      if (target === NEW_CHILD) {
        childId = await addKid({
          name: draft.name,
          // UTC midnight, as AddKidModal stores a birthdate.
          birthdate: Timestamp.fromDate(new Date(draft.birthDate)),
          profilePhoto: '',
          profilePhotoPublicId: '',
          // An unknown time is left out, as the birth sky leaves it out.
          ...(draft.birthTime ? { birthTime: draft.birthTime } : {}),
          birthPlace: draft.birthPlace,
          skyStyle: draft.skyStyle,
        })
      } else {
        await updateKid(target, details)
      }
      clearSkyDraft()
      navigate(`/journal/${childId}/sky`, {
        replace: true,
        state: { skyPoster: { title: draft.title, dedication: draft.dedication, order: draft.order } },
      })
    } catch (err) {
      devError('Taking over the birth sky failed', err)
      setError(true)
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    clearSkyDraft()
    navigate('/home', { replace: true })
  }

  const place = draft.birthPlace.name

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="bg-warm-white rounded-2xl shadow-lg border border-cream-dark w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kaydo/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-kaydo" />
          </div>
          <div>
            <h1 className="font-bold text-bark text-lg">{t('continue.title')}</h1>
            <p className="text-xs text-bark-muted">
              {t('continue.summary', {
                name: draft.name,
                date: formatWallDate(draft.birthDate, lang),
                place,
              })}
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-bark mb-2">{t('continue.question')}</legend>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-cream-dark cursor-pointer has-[:checked]:border-kaydo">
            <input
              type="radio"
              name="sky-target"
              value={NEW_CHILD}
              checked={target === NEW_CHILD}
              onChange={() => setTarget(NEW_CHILD)}
              className="mt-1 accent-kaydo"
            />
            <span className="text-sm text-bark">{t('continue.newChild', { name: draft.name })}</span>
          </label>
          {kids.map((kid) => (
            <label
              key={kid.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-cream-dark cursor-pointer has-[:checked]:border-kaydo"
            >
              <input
                type="radio"
                name="sky-target"
                value={kid.id}
                checked={target === kid.id}
                onChange={() => setTarget(kid.id)}
                className="mt-1 accent-kaydo"
              />
              <span className="text-sm text-bark">
                {t('continue.existingChild', { name: kid.name })}
                <span className="block text-xs text-bark-muted">{t('continue.existingHint')}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="flex gap-1.5 text-xs text-bark-muted">
          <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {t('continue.privacy')}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {t('continue.error')}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleContinue}
            disabled={saving}
            className="btn-kaydo w-full text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('continue.confirm')}
          </button>
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="text-sm font-medium text-bark-muted hover:text-bark py-2"
          >
            {t('continue.discard')}
          </button>
        </div>
      </div>
    </div>
  )
}
