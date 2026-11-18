import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import EncryptedVideo from './EncryptedVideo'
import EncryptedImage from './EncryptedImage'

/**
 * A video that is fetched and decrypted when it is played, not when the page
 * opens. An encrypted clip cannot stream: the whole file, up to 10 MB, is
 * downloaded and decrypted before the first frame. Every clip on a page used
 * to do that on arrival, alongside the photos the page opens with.
 *
 * `poster` is the clip's encrypted still where it has one (moments do); the
 * button shows it, and otherwise a dark frame.
 */
export default function VideoOnTap({ src, title, poster, className = '' }) {
  const { t } = useTranslation('common')
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return <EncryptedVideo src={src} controls autoPlay playsInline className={className} />
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={title || t('media.playVideo')}
      className="relative w-full aspect-video rounded-2xl bg-bark/90 overflow-hidden flex items-center justify-center group"
    >
      {poster && <EncryptedImage src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <span className="relative w-14 h-14 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition-colors">
        <Play className="w-6 h-6 text-bark ml-1" />
      </span>
    </button>
  )
}
