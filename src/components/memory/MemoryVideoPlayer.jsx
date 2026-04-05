import { Video } from 'lucide-react'
import EncryptedVideo from '../media/EncryptedVideo'

export default function MemoryVideoPlayer({ videos }) {
  if (!videos?.length) return null

  return (
    <div className="mt-8 space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-bark">
        <Video className="w-5 h-5 text-hearth" />
        Videos
      </h3>
      {videos.map((video, i) => (
        <div key={video.publicId || i} className="space-y-1.5">
          {video.title && (
            <p className="text-sm font-medium text-bark-light">{video.title}</p>
          )}
          <EncryptedVideo
            src={video.url}
            controls
            playsInline
            className="w-full rounded-2xl bg-black max-h-[480px]"
          />
        </div>
      ))}
    </div>
  )
}
