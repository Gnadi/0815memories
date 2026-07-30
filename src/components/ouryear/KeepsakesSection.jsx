import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ExternalLink, Image as ImageIcon, Loader2, Music, Quote, Sparkles, X } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { encryptAndUpload } from '../../utils/encryptedUpload'
import { devError } from '../../utils/devLog'
import { emptyKeepsakes, keepsakesFilledCount } from '../../utils/ourYear'

/**
 * Four things per chapter, no more: one photo, one song, one sentence, one
 * moment. The cap is the feature — this is meant to hold the essence of a
 * stretch of life, not an album.
 */
export default function KeepsakesSection({ chapter, encryptionKey, readOnly, onUpdateChapter }) {
  const { t } = useTranslation('ourYear')

  // Null until someone edits — until then what is stored is what is shown.
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const stored = { ...emptyKeepsakes(), ...(chapter.keepsakes ?? {}) }
  const keepsakes = draft ?? stored

  const patch = (changes) => {
    setDraft((prev) => ({ ...(prev ?? stored), ...changes }))
    setStatus('idle')
  }

  const patchSong = (changes) => {
    setDraft((prev) => {
      const base = prev ?? stored
      return { ...base, song: { ...base.song, ...changes } }
    })
    setStatus('idle')
  }

  const persist = async (next) => {
    setError('')
    setStatus('saving')
    try {
      await onUpdateChapter({ keepsakes: next })
      setStatus('saved')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  const filled = keepsakesFilledCount(readOnly ? chapter.keepsakes : keepsakes)

  if (readOnly) {
    return (
      <Shell title={t('keepsakes.title')} progress={t('keepsakes.progress', { count: filled })}>
        <ReadOnlyKeepsakes keepsakes={chapter.keepsakes ?? emptyKeepsakes()} />
      </Shell>
    )
  }

  return (
    <Shell
      title={t('keepsakes.title')}
      intro={t('keepsakes.intro')}
      progress={t('keepsakes.progress', { count: filled })}
    >
      <div className="space-y-6">
        <Slot icon={<ImageIcon className="w-4 h-4 text-bark-muted flex-shrink-0" />} label={t('keepsakes.photo.label')} hint={t('keepsakes.photo.hint')}>
          <PhotoSlot
            url={keepsakes.photoUrl}
            encryptionKey={encryptionKey}
            onChange={(photoUrl, photoPublicId) => patch({ photoUrl, photoPublicId })}
          />
        </Slot>

        <Slot icon={<Music className="w-4 h-4 text-bark-muted flex-shrink-0" />} label={t('keepsakes.song.label')} hint={t('keepsakes.song.hint')}>
          <div className="space-y-3">
            <Field
              id="keepsake-song-title"
              label={t('keepsakes.song.titleLabel')}
              value={keepsakes.song?.title ?? ''}
              placeholder={t('keepsakes.song.titlePlaceholder')}
              onChange={(v) => patchSong({ title: v })}
            />
            <Field
              id="keepsake-song-artist"
              label={t('keepsakes.song.artistLabel')}
              value={keepsakes.song?.artist ?? ''}
              placeholder={t('keepsakes.song.artistPlaceholder')}
              onChange={(v) => patchSong({ artist: v })}
            />
            <Field
              id="keepsake-song-link"
              label={t('keepsakes.song.linkLabel')}
              value={keepsakes.song?.link ?? ''}
              placeholder={t('keepsakes.song.linkPlaceholder')}
              onChange={(v) => patchSong({ link: v })}
              type="url"
            />
          </div>
        </Slot>

        <Slot icon={<Quote className="w-4 h-4 text-bark-muted flex-shrink-0" />} label={t('keepsakes.quote.label')} hint={t('keepsakes.quote.hint')}>
          <textarea
            id="keepsake-quote"
            rows={2}
            value={keepsakes.quote ?? ''}
            onChange={(e) => patch({ quote: e.target.value })}
            placeholder={t('keepsakes.quote.placeholder')}
            className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
          />
        </Slot>

        <Slot icon={<Sparkles className="w-4 h-4 text-bark-muted flex-shrink-0" />} label={t('keepsakes.moment.label')} hint={t('keepsakes.moment.hint')}>
          <textarea
            id="keepsake-moment"
            rows={4}
            value={keepsakes.moment ?? ''}
            onChange={(e) => patch({ moment: e.target.value })}
            placeholder={t('keepsakes.moment.placeholder')}
            className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
          />
        </Slot>
      </div>

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      <button
        type="button"
        onClick={() => persist(keepsakes)}
        disabled={status === 'saving'}
        className="mt-5 w-full flex items-center justify-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-50"
      >
        {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'saved' && <Check className="w-4 h-4" />}
        {status === 'saving' ? t('keepsakes.saving') : status === 'saved' ? t('keepsakes.saved') : t('keepsakes.save')}
      </button>
    </Shell>
  )
}

/**
 * A single encrypted photo. Uploads through the same client-side AES path as
 * every other image in Kaydo, so what reaches Cloudinary is ciphertext.
 */
function PhotoSlot({ url, encryptionKey, onChange }) {
  const { t } = useTranslation('ourYear')
  const inputRef = useRef(null)
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setUploading(true)
    try {
      const { url: uploadedUrl, publicId } = await encryptAndUpload(file, encryptionKey)
      onChange(uploadedUrl, publicId)
    } catch (err) {
      devError('Our Year photo upload failed:', err)
    } finally {
      // Drop the local preview either way: on success EncryptedImage takes
      // over with the stored URL, on failure the empty slot comes back.
      setPreview('')
      setUploading(false)
      URL.revokeObjectURL(localPreview)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = () => {
    setPreview('')
    onChange('', '')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="relative">
      {preview || url ? (
        <div className="relative rounded-xl overflow-hidden">
          {preview ? (
            <img src={preview} alt="" className="w-full h-48 object-cover" />
          ) : (
            <EncryptedImage src={url} alt="" className="w-full h-48 object-cover" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={remove}
              aria-label={t('quiz.remove')}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-bark-muted rounded-xl flex flex-col items-center justify-center gap-2 hover:border-kaydo hover:bg-cream-dark/50 transition-colors"
        >
          <ImageIcon className="w-7 h-7 text-bark-muted" />
          <span className="text-sm text-bark-muted">{t('keepsakes.photo.empty')}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
}

function ReadOnlyKeepsakes({ keepsakes }) {
  const { t } = useTranslation('ourYear')
  return (
    <div className="space-y-5">
      {keepsakes.photoUrl && (
        <EncryptedImage src={keepsakes.photoUrl} alt="" className="w-full rounded-xl object-cover max-h-80" />
      )}

      {keepsakes.song?.title && (
        <div className="flex items-start gap-3">
          <Music className="w-4 h-4 text-bark-muted flex-shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="text-sm text-bark">
              {keepsakes.song.title}
              {keepsakes.song.artist ? ` · ${keepsakes.song.artist}` : ''}
            </p>
            {keepsakes.song.link && (
              <a
                href={keepsakes.song.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-kaydo font-medium hover:underline mt-0.5"
              >
                {t('keepsakes.song.listen')}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {keepsakes.quote && (
        <blockquote className="font-serif text-lg text-bark italic border-l-2 border-kaydo/40 pl-4">
          {keepsakes.quote}
        </blockquote>
      )}

      {keepsakes.moment && (
        <p className="text-sm text-bark whitespace-pre-wrap break-words">{keepsakes.moment}</p>
      )}
    </div>
  )
}

function Slot({ icon, label, hint, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="font-serif text-base font-semibold text-bark">{label}</p>
      </div>
      <p className="text-xs text-bark-muted mb-2">{hint}</p>
      {children}
    </div>
  )
}

function Field({ id, label, value, placeholder, onChange, type = 'text' }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-bark mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
      />
    </div>
  )
}

function Shell({ title, intro, progress, children }) {
  return (
    <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-bark leading-snug">{title}</h2>
        {progress && (
          <span className="flex-shrink-0 text-xs font-semibold text-bark-muted bg-cream-dark rounded-full px-2.5 py-1">
            {progress}
          </span>
        )}
      </div>
      {intro && <p className="text-sm text-bark-muted mt-1 max-w-xl">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}
