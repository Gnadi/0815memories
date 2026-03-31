import { useState, useRef } from 'react'
import { X, Lock, Mic, Image as ImageIcon, Calendar, Star, BookOpen } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { CLOUDINARY_CLOUD_NAME } from '../../config/cloudinary'
import VoiceMemoRecorder from './VoiceMemoRecorder'

const MILESTONES = [
  { key: '18thBirthday', label: '18th Birthday' },
  { key: '21stBirthday', label: '21st Birthday' },
  { key: 'graduation',   label: 'Graduation' },
  { key: 'wedding',      label: 'Wedding Day' },
  { key: 'firstJob',     label: 'First Job' },
]

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

export default function CreateBlackBoxModal({ kids, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    message: '',
    childId: kids?.[0]?.id || '',
    triggerType: 'milestone',
    milestone: '18thBirthday',
    specificMonth: '',
    specificDay: '',
    specificYear: '',
  })
  const [photos, setPhotos] = useState([])
  const [voiceNote, setVoiceNote] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const selectedKid = kids?.find((k) => k.id === form.childId)

  const getUnlockDate = () => {
    if (form.triggerType === 'legacy') return null
    if (form.triggerType === 'milestone') {
      return computeMilestoneDate(selectedKid?.birthdate, form.milestone)
    }
    if (form.triggerType === 'specificDate') {
      const { specificYear, specificMonth, specificDay } = form
      if (specificYear && specificMonth && specificDay) {
        return new Date(`${specificYear}-${String(specificMonth).padStart(2,'0')}-${String(specificDay).padStart(2,'0')}`)
      }
    }
    return null
  }

  const unlockDate = getUnlockDate()
  const unlockDateStr = unlockDate
    ? unlockDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const preview = URL.createObjectURL(file)
    const tempId = Date.now()
    setPhotos((prev) => [...prev, { id: tempId, preview, url: '', uploading: true }])

    try {
      const signRes = await fetch('/api/cloudinary-sign')
      if (!signRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, folder, apiKey } = await signRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      setPhotos((prev) =>
        prev.map((p) => (p.id === tempId ? { ...p, url: data.secure_url, uploading: false } : p))
      )
    } catch (err) {
      console.error('Upload failed:', err)
      setPhotos((prev) => prev.filter((p) => p.id !== tempId))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.message.trim() && photos.length === 0 && !voiceNote) return
    if (form.triggerType !== 'legacy' && !unlockDate) return
    setSaving(true)
    try {
      const data = {
        title: form.title.trim() || `For ${selectedKid?.name || 'the future'}`,
        message: form.message,
        childId: form.childId || null,
        triggerType: form.triggerType,
        milestone: form.triggerType === 'milestone' ? form.milestone : null,
        unlockDate: unlockDate ? Timestamp.fromDate(unlockDate) : null,
        photos: photos.filter((p) => p.url).map((p) => p.url),
        voiceNote: voiceNote || null,
      }
      await onSave(data)
      onClose()
    } catch (err) {
      console.error('Failed to seal black box:', err)
    } finally {
      setSaving(false)
    }
  }

  const hasUploading = photos.some((p) => p.uploading)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-warm-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-warm-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-bark">Preserving a Moment</h2>
            <p className="text-xs text-bark-muted mt-0.5">
              Create a digital heirloom that remains sealed until the perfect moment.
            </p>
          </div>
          <button onClick={onClose} className="text-bark-muted hover:text-bark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* Two columns on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ── STEP 1: THE MESSAGE ── */}
            <div className="bg-cream rounded-2xl p-4 space-y-4">
              <p className="text-xs font-bold text-hearth uppercase tracking-wide">Step 1: The Message</p>

              {/* For which child */}
              {kids?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-bark mb-1">For</label>
                  <select
                    value={form.childId}
                    onChange={(e) => setForm((p) => ({ ...p, childId: e.target.value }))}
                    className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-hearth/30"
                  >
                    <option value="">No specific child</option>
                    {kids.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-bark mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder={selectedKid ? `For ${selectedKid.name}…` : 'A message from the heart…'}
                  className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-hearth/30"
                />
              </div>

              {/* Voice note */}
              <div>
                {voiceNote ? (
                  <div className="flex items-center justify-between bg-warm-white rounded-xl px-3 py-2 border border-cream-dark">
                    <span className="text-sm text-bark">🎙 Voice note recorded</span>
                    <button
                      type="button"
                      onClick={() => setVoiceNote(null)}
                      className="text-bark-muted hover:text-hearth"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : showRecorder ? (
                  <VoiceMemoRecorder
                    onSave={(memo) => { setVoiceNote(memo); setShowRecorder(false) }}
                    onCancel={() => setShowRecorder(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRecorder(true)}
                    className="w-full border-2 border-dashed border-cream-darker rounded-xl py-4 flex flex-col items-center gap-2 text-bark-muted hover:border-hearth hover:text-hearth transition-colors"
                  >
                    <Mic className="w-6 h-6" />
                    <span className="text-sm font-medium">Record a Voice Note</span>
                    <span className="text-xs">Speak from the heart</span>
                  </button>
                )}
              </div>

              {/* Text message */}
              <div>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Or type your message here…"
                  rows={5}
                  className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-hearth/30 resize-none"
                />
              </div>

              {/* Photos */}
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
                        onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
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
                  className="w-16 h-16 border-2 border-dashed border-cream-darker rounded-xl flex flex-col items-center justify-center gap-1 text-bark-muted hover:border-hearth hover:text-hearth transition-colors text-xs"
                >
                  <ImageIcon className="w-5 h-5" />
                  Photos
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* ── STEP 2: TIME TRIGGER ── */}
            <div className="bg-cream rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-hearth uppercase tracking-wide">Step 2: The Time Trigger</p>

              {/* Milestone */}
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, triggerType: 'milestone' }))}
                className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                  form.triggerType === 'milestone'
                    ? 'border-hearth bg-warm-white'
                    : 'border-transparent bg-warm-white/50 hover:bg-warm-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-bark">A Life Milestone</span>
                </div>
                {form.triggerType === 'milestone' && (
                  <select
                    value={form.milestone}
                    onChange={(e) => setForm((p) => ({ ...p, milestone: e.target.value }))}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
                  >
                    {MILESTONES.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
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
                    ? 'border-hearth bg-warm-white'
                    : 'border-transparent bg-warm-white/50 hover:bg-warm-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-bark">Specific Date</span>
                </div>
                {form.triggerType === 'specificDate' && (
                  <div className="grid grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-xs text-bark-muted">Month</label>
                      <input
                        type="number" min="1" max="12"
                        placeholder="MM"
                        value={form.specificMonth}
                        onChange={(e) => setForm((p) => ({ ...p, specificMonth: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-bark-muted">Day</label>
                      <input
                        type="number" min="1" max="31"
                        placeholder="DD"
                        value={form.specificDay}
                        onChange={(e) => setForm((p) => ({ ...p, specificDay: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-bark-muted">Year</label>
                      <input
                        type="number" min={new Date().getFullYear()}
                        placeholder="YYYY"
                        value={form.specificYear}
                        onChange={(e) => setForm((p) => ({ ...p, specificYear: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded-lg text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
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
                    ? 'border-hearth bg-warm-white'
                    : 'border-transparent bg-warm-white/50 hover:bg-warm-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="text-sm font-semibold text-bark">Legacy Trigger</span>
                    <p className="text-xs text-bark-muted">Release after my passing</p>
                  </div>
                </div>
              </button>

              {/* Confirmation notice */}
              {(unlockDateStr || form.triggerType === 'legacy') && (
                <div className="flex items-start gap-2 bg-bark/5 rounded-xl px-3 py-2">
                  <div className="w-3 h-3 rounded-full bg-hearth mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-bark-muted leading-relaxed">
                    {form.triggerType === 'legacy'
                      ? 'Once sealed, this box will only be released upon a legacy trigger. Your legacy is safe with us.'
                      : <>
                          Once sealed, this box cannot be opened until{' '}
                          <span className="text-hearth font-semibold">{unlockDateStr}</span>.{' '}
                          Your legacy is safe with us.
                        </>
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={saving || hasUploading || (!form.message.trim() && photos.length === 0 && !voiceNote)}
            className="w-full flex items-center justify-center gap-2 bg-bark text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {saving ? 'Sealing…' : 'Seal into The Black Box'}
          </button>
        </form>
      </div>
    </div>
  )
}
