import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CalendarDays, Image as ImageIcon, Mic, Video, X } from 'lucide-react'
import { Timestamp } from '../config/firestore'
import { EMOTIONS } from '../constants/emotions'
import VoiceMemoRecorder from '../components/admin/VoiceMemoRecorder'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useJournals } from '../hooks/useJournals'
import { useMediaUploader } from '../hooks/useMediaUploader'
import EncryptedImage from '../components/media/EncryptedImage'
import EncryptedVideo from '../components/media/EncryptedVideo'
import JournalContentField from '../components/journal/JournalContentField'
import { devError } from '../utils/devLog'
import {
  EMPTY_CONTENT,
  contentFromEntry,
  contentIsEmpty,
  contentToFields,
  entryDate,
} from '../utils/journalContent'

// The date input speaks YYYY-MM-DD. Entries have always been stored at UTC
// midnight of the day picked, so that is how a stored date is read back.
const storedDay = (date) => date.toISOString().split('T')[0]

function localToday() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function AttachButton({ icon: Icon, label, onClick, active = false, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      className={`min-h-12 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'bg-kaydo text-white border-kaydo'
          : 'bg-warm-white text-bark border-cream-dark hover:border-kaydo hover:text-kaydo'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  )
}

function UploadingOverlay() {
  return (
    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function RemoveButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute top-1 right-1 w-7 h-7 bg-bark/80 text-white rounded-full flex items-center justify-center"
    >
      <X className="w-4 h-4" />
    </button>
  )
}

/**
 * Writes or edits a journal entry, full-screen.
 *
 * The page scrolls inside its own column below a fixed header, so the save
 * button stays in reach while the keyboard is up, and the editor's toolbar
 * sticks to the top of the column rather than sliding under the header.
 */
export default function JournalEntryPage() {
  const { t } = useTranslation('journal')
  const { childId, entryId } = useParams()
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { kids } = useKids(familyId, encryptionKey)
  const { journals, addJournal, updateJournal } = useJournals(familyId, childId, encryptionKey)

  const kid = kids.find((k) => k.id === childId)
  const entry = entryId ? journals.find((j) => j.id === entryId) : null

  const [form, setForm] = useState(() => ({
    title: '',
    volume: '',
    emotion: 'love',
    date: localToday(),
  }))
  const [content, setContent] = useState(EMPTY_CONTENT)
  // The editor reads its value once, when it mounts. An entry arrives from
  // Firestore after the page does, so the field waits for it.
  const [loaded, setLoaded] = useState(!entryId)
  const {
    images,
    videos,
    setImages,
    setVideos,
    addImage,
    addVideo,
    removeImage,
    removeVideo,
    videoError,
    imageError,
    hasUploading,
  } = useMediaUploader(encryptionKey)
  const [voiceMemos, setVoiceMemos] = useState([])
  const [showRecorder, setShowRecorder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const videoFileInputRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  useEffect(() => {
    if (!entry) return
    const date = entryDate(entry)
    setForm({
      title: entry.title || '',
      volume: entry.volume || '',
      emotion: entry.emotion || 'love',
      date: date ? storedDay(date) : localToday(),
    })
    setContent(contentFromEntry(entry))
    setImages(
      entry.photos?.map((url, i) => ({ id: i, preview: url, url, uploading: false })) || []
    )
    setVideos(
      entry.videos?.map((v, i) => ({
        id: i, preview: v.url, url: v.url, publicId: v.publicId, title: v.title || '', uploading: false,
      })) || []
    )
    setVoiceMemos(entry.voiceMemos || [])
    setLoaded(true)
    // Only when another entry arrives: the snapshot listener delivers this one
    // again on every change, and that must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, setImages, setVideos])

  if (!isAdmin) return null

  const back = () => navigate(entryId ? `/journal/${childId}/view/${entryId}` : `/journal/${childId}`)
  const empty = contentIsEmpty(content)
  const canSave = loaded && !empty && !saving && !hasUploading

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    await Promise.all(files.map((file) => addImage(file)))
  }

  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (videoFileInputRef.current) videoFileInputRef.current.value = ''
    await addVideo(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setError('')
    setSaving(true)
    try {
      const fields = contentToFields(content)
      const data = {
        ...form,
        ...fields,
        date: Timestamp.fromDate(new Date(form.date)),
        photos: images.filter((img) => img.url).map((img) => img.url),
        videos: videos.filter((v) => v.url).map((v) => ({ url: v.url, publicId: v.publicId, title: v.title })),
        voiceMemos,
      }
      if (entry) {
        await updateJournal(entry.id, data)
        navigate(`/journal/${childId}/view/${entry.id}`, { replace: true })
      } else {
        await addJournal(data)
        navigate(`/journal/${childId}`, { replace: true })
      }
    } catch (err) {
      devError('Failed to save journal entry:', err)
      setError(t('editor.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const saveLabel = saving
    ? t('editor.saving')
    : hasUploading
      ? t('editor.uploading')
      : entry ? t('editor.update') : t('editor.save')

  const placeholder = t('editor.contentPlaceholder', { name: kid?.name || t('editor.contentPlaceholderFallback') })
  const hasMedia = images.length > 0 || videos.length > 0

  return (
    <form
      id="journal-entry-form"
      onSubmit={handleSubmit}
      className="h-[100dvh] flex flex-col bg-cream"
    >
      <header className="flex-shrink-0 bg-cream border-b border-cream-dark pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-2 sm:px-4 py-2">
          <button
            type="button"
            onClick={back}
            aria-label={t('editor.back')}
            className="w-11 h-11 rounded-full flex items-center justify-center text-bark-muted hover:text-bark hover:bg-cream-dark transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-bark-muted leading-tight">
              {entry ? t('editor.editHeading') : t('editor.newHeading')}
            </p>
            <p className="font-semibold text-bark truncate leading-tight">
              {kid?.name ? t('editor.forName', { name: kid.name }) : t('archive.fallbackTitle')}
            </p>
          </div>
          <button
            type="submit"
            disabled={!canSave}
            className="btn-kaydo text-sm py-2 px-4 min-h-11 disabled:opacity-50 flex-shrink-0"
          >
            {saveLabel}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto w-full px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] space-y-6">
          {/* Title. The `!` beats the 16px floor index.css sets for every input. */}
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder={t('editor.titlePlaceholder')}
            aria-label={t('editor.titleLabel')}
            className="w-full bg-transparent font-serif text-2xl! sm:text-3xl! font-bold text-bark placeholder-bark-muted/50 outline-none leading-tight"
          />

          {/* Date + volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-bark-muted uppercase tracking-wide mb-1.5">
                {t('editor.dateLabel')}
              </span>
              <span className="flex items-center gap-2 bg-warm-white border border-cream-dark rounded-xl px-3 min-h-12 focus-within:border-kaydo transition-colors">
                <CalendarDays className="w-4 h-4 text-bark-muted flex-shrink-0" />
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value || p.date }))}
                  className="flex-1 min-w-0 bg-transparent text-bark outline-none py-2"
                />
              </span>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-bark-muted uppercase tracking-wide mb-1.5">
                {t('editor.volumeLabel')}
              </span>
              <input
                type="text"
                value={form.volume}
                onChange={(e) => setForm((p) => ({ ...p, volume: e.target.value }))}
                placeholder={t('editor.volumePlaceholder')}
                className="w-full bg-warm-white border border-cream-dark rounded-xl px-3 min-h-12 text-bark placeholder-bark-muted/60 outline-none focus:border-kaydo transition-colors"
              />
            </label>
          </div>

          {/* Emotion: one row that scrolls sideways on a phone, rather than a
              block of chips pushing the text off the screen. */}
          <fieldset>
            <legend className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-1.5">
              {t('editor.emotionLabel')}
            </legend>
            <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
              {EMOTIONS.map((em) => {
                const selected = form.emotion === em.key
                return (
                  <button
                    key={em.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm((p) => ({ ...p, emotion: em.key }))}
                    className={`flex-shrink-0 flex items-center gap-1.5 min-h-10 px-3 rounded-full text-sm font-medium border transition-colors ${
                      selected
                        ? `${em.bg} ${em.text} border-current`
                        : 'bg-warm-white border-cream-dark text-bark-muted hover:text-bark'
                    }`}
                  >
                    <span aria-hidden="true">{em.emoji}</span> {t('emotions:' + em.key)}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Text */}
          {loaded ? (
            <JournalContentField
              value={content}
              onChange={setContent}
              placeholder={placeholder}
              disabled={saving}
            />
          ) : (
            <div className="min-h-[248px] rounded-xl bg-cream-dark animate-pulse" />
          )}

          {/* Attachments */}
          <section>
            <h2 className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-1.5">
              {t('editor.attachmentsLabel')}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <AttachButton icon={ImageIcon} label={t('editor.addPhoto')} onClick={() => fileInputRef.current?.click()} disabled={saving} />
              <AttachButton icon={Video} label={t('editor.addVideo')} onClick={() => videoFileInputRef.current?.click()} disabled={saving} />
              <AttachButton icon={Mic} label={t('editor.addVoice')} active={showRecorder} onClick={() => setShowRecorder((v) => !v)} disabled={saving} />
            </div>

            {showRecorder && (
              <div className="mt-3">
                <VoiceMemoRecorder
                  onMemoAdded={(memo) => { setVoiceMemos((p) => [...p, memo]); setShowRecorder(false) }}
                />
              </div>
            )}

            {hasMedia && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map((img) => (
                  <div key={`img-${img.id}`} className="relative aspect-square">
                    {img.preview?.startsWith('blob:') ? (
                      <img src={img.preview} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <EncryptedImage src={img.preview} alt="" className="w-full h-full rounded-xl object-cover" />
                    )}
                    {img.uploading
                      ? <UploadingOverlay />
                      : <RemoveButton onClick={() => removeImage(img.id)} label={t('editor.removePhoto')} />}
                  </div>
                ))}
                {videos.map((v) => (
                  <div key={`vid-${v.id}`} className="relative aspect-square">
                    {v.preview?.startsWith('blob:') ? (
                      <video src={v.preview} className="w-full h-full rounded-xl object-cover bg-black" muted playsInline />
                    ) : (
                      <EncryptedVideo src={v.preview} className="w-full h-full rounded-xl object-cover bg-black" controls={false} muted playsInline />
                    )}
                    {v.uploading ? <UploadingOverlay /> : (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                            <Video className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <RemoveButton onClick={() => removeVideo(v.id)} label={t('editor.removeVideo')} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {voiceMemos.length > 0 && (
              <ul className="mt-3 space-y-2">
                {voiceMemos.map((memo, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 bg-warm-white border border-cream-dark rounded-xl pl-3 pr-1 min-h-12">
                    <span className="flex items-center gap-2 text-sm text-bark min-w-0">
                      <Mic className="w-4 h-4 text-kaydo flex-shrink-0" />
                      <span className="truncate">{memo.title || t('editor.voiceNote', { index: idx + 1 })}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceMemos((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={t('editor.removeVoice')}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-bark-muted hover:text-kaydo transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(error || videoError || imageError) && (
            <p role="alert" className="text-sm text-red-600">{error || videoError || imageError}</p>
          )}

          {/* A second way to save at the end of the letter, where the thumb is
              after writing it. */}
          <button
            type="submit"
            disabled={!canSave}
            className="btn-kaydo w-full min-h-12 disabled:opacity-50"
          >
            {saveLabel}
          </button>
          {loaded && empty && (
            <p className="-mt-4 text-xs text-bark-muted text-center">{t('editor.emptyHint')}</p>
          )}
        </div>
      </main>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      <input ref={videoFileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFileChange} />
    </form>
  )
}
