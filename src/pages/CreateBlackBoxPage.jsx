import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Lock, Mic, Image as ImageIcon, Calendar, Star, BookOpen, Video, Camera, ArrowLeft, Baby } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import VoiceMemoRecorder from '../components/admin/VoiceMemoRecorder'
import Sidebar from '../components/layout/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useBlackBox } from '../hooks/useBlackBox'
import { useKids } from '../hooks/useKids'
import { useMediaUploader } from '../hooks/useMediaUploader'
import { devError } from '../utils/devLog'

const MILESTONES = ['18thBirthday', '21stBirthday', 'graduation', 'wedding', 'firstJob']

function computeMilestoneDate(birthdate, milestone) {
  if (!birthdate) return null
  const bd = birthdate.toDate ? birthdate.toDate() : new Date(birthdate)
  const d = new Date(bd)
  if (milestone === '18thBirthday') d.setFullYear(d.getFullYear() + 18)
  else if (milestone === '21stBirthday') d.setFullYear(d.getFullYear() + 21)
  else if (milestone === 'graduation') d.setFullYear(d.getFullYear() + 22)
  else if (milestone === 'wedding') d.setFullYear(d.getFullYear() + 25)
  else if (milestone === 'firstJob') d.setFullYear(d.getFullYear() + 22)
  return d
}

export default function CreateBlackBoxPage() {
  const { t } = useTranslation('blackbox')
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { kids, loading: kidsLoading } = useKids(familyId, encryptionKey)
  const { addBox } = useBlackBox(familyId, encryptionKey)
  const {
    images: photos,
    videos,
    addImage,
    addVideo,
    removeImage,
    removeVideo,
    videoError,
    hasUploading,
  } = useMediaUploader(encryptionKey)

  const [form, setForm] = useState({
    title: '',
    message: '',
    childId: '',
    triggerType: 'milestone',
    milestone: '18thBirthday',
    specificMonth: '',
    specificDay: '',
    specificYear: '',
  })
  const [voiceNote, setVoiceNote] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const videoFileInputRef = useRef(null)
  const videoCameraInputRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  // Pre-select first kid once loaded
  useEffect(() => {
    if (kids.length > 0 && !form.childId) {
      setForm((p) => ({ ...p, childId: kids[0].id }))
    }
  }, [kids])

  if (!isAdmin) return null

  const selectedKid = kids.find((k) => k.id === form.childId)

  const getUnlockDate = () => {
    if (form.triggerType === 'legacy') return null
    if (form.triggerType === 'milestone') {
      return computeMilestoneDate(selectedKid?.birthdate, form.milestone)
    }
    if (form.triggerType === 'specificDate') {
      const { specificYear, specificMonth, specificDay } = form
      if (specificYear && specificMonth && specificDay) {
        return new Date(`${specificYear}-${String(specificMonth).padStart(2, '0')}-${String(specificDay).padStart(2, '0')}`)
      }
    }
    return null
  }

  const unlockDate = getUnlockDate()
  const unlockDateStr = unlockDate
    ? unlockDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const handleImagePick = async (e, inputRef) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef?.current) inputRef.current.value = ''
    await addImage(file)
  }

  const handleVideoPick = async (e, inputRef) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef?.current) inputRef.current.value = ''
    await addVideo(file)
  }

  const hasContent = form.message.trim() || photos.length > 0 || videos.length > 0 || voiceNote

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!hasContent) {
      setSubmitError(t('errors.noContent'))
      return
    }
    if (form.triggerType !== 'legacy' && !unlockDate) {
      if (form.triggerType === 'milestone' && !selectedKid?.birthdate) {
        setSubmitError(t('errors.milestoneNeedsBirthday'))
      } else if (form.triggerType === 'specificDate') {
        setSubmitError(t('errors.incompleteDate'))
      } else {
        setSubmitError(t('errors.noUnlockDate'))
      }
      return
    }
    setSaving(true)
    try {
      const data = {
        title: form.title.trim() || t('defaultTitle', { name: selectedKid?.name || t('defaultTitleFallback') }),
        message: form.message,
        childId: form.childId || null,
        triggerType: form.triggerType,
        milestone: form.triggerType === 'milestone' ? form.milestone : null,
        unlockDate: unlockDate ? Timestamp.fromDate(unlockDate) : null,
        photos: photos.filter((p) => p.url).map((p) => p.url),
        videos: videos.filter((v) => v.url).map((v) => ({ url: v.url, publicId: v.publicId })),
        voiceNote: voiceNote || null,
      }
      await addBox(data)
      navigate('/blackbox')
    } catch (err) {
      devError('Failed to seal black box:', err)
      setSubmitError(err.message || t('errors.sealFailed'))
    } finally {
      setSaving(false)
    }
  }

  const ctaDisabled = saving || hasUploading || !hasContent

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">

        {/* Mobile sticky top bar */}
        <div className="lg:hidden sticky top-0 z-10 bg-cream border-b border-cream-dark px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/blackbox')}
            className="text-bark-muted hover:text-bark p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-bark">{t('create.headerTitle')}</h1>
          <button
            type="button"
            onClick={() => navigate('/blackbox')}
            className="text-bark-muted hover:text-bark p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto pb-28 lg:pb-8">
          <form
            id="blackbox-form"
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto px-4 py-6 lg:py-10 space-y-6"
          >
            {/* Desktop header */}
            <div className="hidden lg:flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-bark">{t('create.headerTitle')}</h1>
                <p className="text-sm text-bark-muted mt-1">
                  {t('create.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/blackbox')}
                className="text-bark-muted hover:text-bark mt-1 ml-4 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Two-column form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* ── STEP 1: THE MESSAGE ── */}
              <div className="bg-warm-white rounded-2xl p-4 space-y-4 shadow-sm">
                <p className="text-xs font-bold text-kaydo uppercase tracking-wide">{t('create.step1Label')}</p>

                {/* For which child */}
                {!kidsLoading && kids.length === 0 && (
                  <div className="flex items-start gap-3 bg-cream-dark rounded-xl p-3">
                    <Baby className="w-5 h-5 text-bark-muted mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-bark-muted">
                      {t('create.noChildren')}{' '}
                      <Link to="/journal" className="text-kaydo underline underline-offset-2 hover:opacity-80">
                        {t('create.addChild')}
                      </Link>{' '}
                      {t('create.addChildSuffix')}
                    </p>
                  </div>
                )}
                {kids.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-bark mb-1">{t('create.forLabel')}</label>
                    <select
                      value={form.childId}
                      onChange={(e) => setForm((p) => ({ ...p, childId: e.target.value }))}
                      className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30"
                    >
                      <option value="">{t('create.noSpecificChild')}</option>
                      {kids.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-bark mb-1">{t('create.titleLabel')}</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={selectedKid ? t('create.titlePlaceholderChild', { name: selectedKid.name }) : t('create.titlePlaceholderGeneric')}
                    className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30"
                  />
                </div>

                {/* Voice note */}
                <div>
                  {voiceNote ? (
                    <div className="flex items-center justify-between bg-cream rounded-xl px-3 py-2 border border-cream-dark">
                      <span className="text-sm text-bark">{t('create.voiceNoteRecorded')}</span>
                      <button
                        type="button"
                        onClick={() => setVoiceNote(null)}
                        className="text-bark-muted hover:text-kaydo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : showRecorder ? (
                    <VoiceMemoRecorder
                      onMemoAdded={(memo) => { setVoiceNote(memo); setShowRecorder(false) }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowRecorder(true)}
                      className="w-full border-2 border-dashed border-cream-darker rounded-xl py-5 flex flex-col items-center gap-2 text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-kaydo flex items-center justify-center">
                        <Mic className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium">{t('create.recordVoiceNote')}</span>
                      <span className="text-xs">{t('create.speakFromHeart')}</span>
                    </button>
                  )}
                </div>

                {/* Text message */}
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder={t('create.messagePlaceholder')}
                  rows={5}
                  className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
                />

                {/* Photos */}
                <div>
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((p) => (
                      <div key={p.id} className="relative w-16 h-16 flex-shrink-0">
                        <img src={p.preview} alt="" className="w-16 h-16 rounded-xl object-cover" />
                        {p.uploading ? (
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeImage(p.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark text-white rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-cream-darker rounded-xl flex flex-col items-center justify-center gap-1 text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors text-xs"
                    >
                      <ImageIcon className="w-5 h-5" />
                      {t('create.photos')}
                    </button>
                    {/* Take photo - mobile only */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-cream-darker rounded-xl flex flex-col items-center justify-center gap-1 text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors text-xs lg:hidden"
                    >
                      <Camera className="w-5 h-5" />
                      {t('create.camera')}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImagePick(e, fileInputRef)} />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImagePick(e, cameraInputRef)} />
                </div>

                {/* Videos */}
                <div className="space-y-1">
                  <div className="flex gap-2 flex-wrap">
                    {videos.map((v) => (
                      <div key={v.id} className="relative w-16 h-16 flex-shrink-0">
                        <video src={v.preview} className="w-16 h-16 rounded-xl object-cover bg-black" muted playsInline />
                        {!v.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                              <Video className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                        {v.uploading && (
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {!v.uploading && (
                          <button
                            type="button"
                            onClick={() => removeVideo(v.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark text-white rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-cream-darker rounded-xl flex flex-col items-center justify-center gap-1 text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors text-xs"
                    >
                      <Video className="w-5 h-5" />
                      {t('create.video')}
                    </button>
                    {/* Record video - mobile only */}
                    <button
                      type="button"
                      onClick={() => videoCameraInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-cream-darker rounded-xl flex flex-col items-center justify-center gap-1 text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors text-xs lg:hidden"
                    >
                      <Camera className="w-5 h-5" />
                      {t('create.record')}
                    </button>
                  </div>
                  {videoError && <p className="text-xs text-kaydo">{videoError}</p>}
                  <input ref={videoFileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoPick(e, videoFileInputRef)} />
                  <input ref={videoCameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => handleVideoPick(e, videoCameraInputRef)} />
                </div>
              </div>

              {/* ── STEP 2: THE TIME TRIGGER ── */}
              <div className="bg-warm-white rounded-2xl p-4 space-y-3 shadow-sm">
                <p className="text-xs font-bold text-kaydo uppercase tracking-wide">{t('create.step2Label')}</p>

                {/* Milestone */}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, triggerType: 'milestone' }))}
                  className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                    form.triggerType === 'milestone'
                      ? 'border-kaydo bg-cream'
                      : 'border-transparent bg-cream/50 hover:bg-cream'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-bark">{t('create.milestone')}</span>
                  </div>
                  {form.triggerType === 'milestone' && (
                    <select
                      value={form.milestone}
                      onChange={(e) => setForm((p) => ({ ...p, milestone: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-kaydo/30"
                    >
                      {MILESTONES.map((m) => (
                        <option key={m} value={m}>{t(`milestones.${m}`)}</option>
                      ))}
                    </select>
                  )}
                </button>

                {/* Specific date */}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, triggerType: 'specificDate' }))}
                  className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                    form.triggerType === 'specificDate'
                      ? 'border-kaydo bg-cream'
                      : 'border-transparent bg-cream/50 hover:bg-cream'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-semibold text-bark">{t('create.specificDate')}</span>
                  </div>
                  {form.triggerType === 'specificDate' && (
                    <div className="grid grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="text-xs text-bark-muted">{t('create.month')}</label>
                        <input
                          type="number" min="1" max="12" placeholder={t('datePlaceholder.month')}
                          value={form.specificMonth}
                          onChange={(e) => setForm((p) => ({ ...p, specificMonth: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-kaydo/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-bark-muted">{t('create.day')}</label>
                        <input
                          type="number" min="1" max="31" placeholder={t('datePlaceholder.day')}
                          value={form.specificDay}
                          onChange={(e) => setForm((p) => ({ ...p, specificDay: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-kaydo/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-bark-muted">{t('create.year')}</label>
                        <input
                          type="number" min={new Date().getFullYear()} placeholder={t('datePlaceholder.year')}
                          value={form.specificYear}
                          onChange={(e) => setForm((p) => ({ ...p, specificYear: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-kaydo/30"
                        />
                      </div>
                    </div>
                  )}
                </button>

                {/* Legacy trigger */}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, triggerType: 'legacy' }))}
                  className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                    form.triggerType === 'legacy'
                      ? 'border-kaydo bg-cream'
                      : 'border-transparent bg-cream/50 hover:bg-cream'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <div>
                      <span className="text-sm font-semibold text-bark">{t('create.legacyTrigger')}</span>
                      <p className="text-xs text-bark-muted">{t('create.legacyTriggerDesc')}</p>
                    </div>
                  </div>
                </button>

                {/* Confirmation notice */}
                {(unlockDateStr || form.triggerType === 'legacy') && (
                  <div className="flex items-start gap-2 bg-kaydo/5 rounded-xl px-3 py-2">
                    <div className="w-3 h-3 rounded-full bg-kaydo mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-bark-muted leading-relaxed">
                      {form.triggerType === 'legacy'
                        ? t('create.noticeLegacy')
                        : <>
                            {t('create.noticeDatePrefix')}{' '}
                            <span className="text-kaydo font-semibold">{unlockDateStr}</span>{t('create.noticeDateSuffix')}
                          </>
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Hero section */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-stone-800 via-amber-950 to-stone-900 min-h-44 flex items-end p-6">
              <div>
                <p className="text-2xl font-bold text-white">A gift for the future.</p>
                <p className="text-sm text-white/60 mt-1">
                  Your words will become the memories that sustain them tomorrow.
                </p>
              </div>
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:block space-y-3">
              {submitError && <p className="text-xs text-red-500 text-center">{submitError}</p>}
              <button
                type="submit"
                disabled={ctaDisabled}
                className="w-full flex items-center justify-center gap-2 bg-kaydo text-white py-4 rounded-2xl text-sm font-bold hover:bg-kaydo/90 transition-colors disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {saving ? 'Sealing…' : 'Seal into The Black Box'}
              </button>
            </div>
          </form>
        </div>

        {/* Mobile sticky bottom CTA */}
        <div className="lg:hidden sticky bottom-0 bg-cream border-t border-cream-dark px-4 py-4 space-y-2">
          {submitError && <p className="text-xs text-red-500 text-center">{submitError}</p>}
          <button
            type="submit"
            form="blackbox-form"
            disabled={ctaDisabled}
            className="w-full flex items-center justify-center gap-2 bg-kaydo text-white py-4 rounded-2xl text-sm font-bold hover:bg-kaydo/90 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {saving ? 'Sealing…' : 'Seal into The Black Box'}
          </button>
        </div>

      </div>
    </div>
  )
}
