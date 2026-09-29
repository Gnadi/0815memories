import { useTranslation } from 'react-i18next'
import { X, Video, GripVertical } from 'lucide-react'
import EncryptedVideo from '../media/EncryptedVideo'
import SortableMediaGroup from './SortableMediaGroup'
import { useSortableMedia } from './useSortableMedia'

function VideoRow({ video, index, videos, onTitleChange, onRemove, onMove }) {
  const { t } = useTranslation('memory')
  const count = videos.length
  const { setRef, handleProps, style, isDragging, isOver } = useSortableMedia(video.id, {
    prevId: videos[index - 1]?.id,
    nextId: videos[index + 1]?.id,
    onMove,
  })

  return (
    <div
      ref={setRef}
      style={style}
      className={`relative flex items-start gap-3 bg-cream-dark rounded-xl p-3 ${
        isDragging ? 'z-20 opacity-80 shadow-lg' : ''
      } ${isOver ? 'ring-2 ring-kaydo' : ''}`}
    >
      {/* Only the grip starts a drag, so the title field stays usable for
          selecting text. */}
      {count > 1 && (
        <button
          type="button"
          {...handleProps}
          aria-label={t('mediaOrder.videoLabel', { position: index + 1, count })}
          className={`self-center -ml-1 text-bark-muted hover:text-bark touch-manipulation select-none [-webkit-touch-callout:none] ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          } focus:outline-none focus-visible:ring-2 focus-visible:ring-kaydo rounded`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="relative w-16 h-16 flex-shrink-0">
        {video.preview?.startsWith('blob:') ? (
          <video
            src={video.preview}
            className="w-16 h-16 rounded-lg object-cover bg-black"
            muted
            playsInline
          />
        ) : (
          <EncryptedVideo
            src={video.preview}
            className="w-16 h-16 rounded-lg object-cover bg-black"
            controls={false}
            muted
            playsInline
          />
        )}
        {!video.uploading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
              <Video className="w-3 h-3 text-white" />
            </div>
          </div>
        )}
        {video.uploading && (
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={video.title}
          onChange={(e) => onTitleChange(video.id, e.target.value)}
          placeholder={t('postMemory.videoTitlePlaceholder')}
          className="w-full px-3 py-1.5 bg-white rounded-lg text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          disabled={video.uploading}
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(video.id)}
        aria-label={t('mediaOrder.videoRemove')}
        className="text-bark-muted hover:text-red-500 transition-colors mt-1 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * The memory dialog's videos, one row each with its title, in the order they
 * will be saved. Rows are reordered by dragging their grip.
 */
export default function SortableVideoList({ videos, onTitleChange, onRemove, onMove }) {
  const { t } = useTranslation('memory')
  if (videos.length === 0) return null

  return (
    <div className="mb-3">
      <SortableMediaGroup onMove={onMove}>
        <div className="space-y-3">
          {videos.map((v, i) => (
            <VideoRow
              key={v.id}
              video={v}
              index={i}
              videos={videos}
              onTitleChange={onTitleChange}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))}
        </div>
      </SortableMediaGroup>
      {videos.length > 1 && (
        <p className="text-xs text-bark-muted mt-1.5">{t('mediaOrder.videoHint')}</p>
      )}
    </div>
  )
}
