import { useTranslation } from 'react-i18next'
import { X, Video } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import EncryptedVideo from '../media/EncryptedVideo'
import SortableMediaGroup from './SortableMediaGroup'
import { useSortableMedia, stopDrag } from './useSortableMedia'

// pointer-events-none on the previews keeps the browser's own image drag and
// long-press menu from hijacking the gesture meant for reordering.
function Preview({ item, kind }) {
  const className = 'w-20 h-20 rounded-xl object-cover pointer-events-none'
  const local = item.preview?.startsWith('blob:')
  if (kind === 'video') {
    return local ? (
      <video src={item.preview} className={`${className} bg-black`} muted playsInline />
    ) : (
      <EncryptedVideo
        src={item.preview}
        className={`${className} bg-black`}
        controls={false}
        muted
        playsInline
      />
    )
  }
  return local ? (
    <img src={item.preview} alt="" draggable={false} className={className} />
  ) : (
    <EncryptedImage src={item.preview} draggable={false} className={className} />
  )
}

function MediaTile({ item, kind, index, items, onRemove, onMove }) {
  const { t } = useTranslation('memory')
  const count = items.length
  const { setRef, handleProps, style, isDragging, isOver } = useSortableMedia(item.id, {
    prevId: items[index - 1]?.id,
    nextId: items[index + 1]?.id,
    onMove,
  })

  return (
    <div
      ref={setRef}
      {...handleProps}
      aria-label={t(`mediaOrder.${kind}Label`, { position: index + 1, count })}
      style={style}
      className={`relative w-20 h-20 flex-shrink-0 rounded-xl select-none [-webkit-touch-callout:none] ${
        count > 1 ? 'cursor-grab touch-manipulation' : ''
      } ${isDragging ? 'z-20 cursor-grabbing opacity-80 shadow-lg' : ''} ${
        isOver ? 'ring-2 ring-kaydo ring-offset-2' : ''
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-kaydo`}
    >
      <Preview item={item} kind={kind} />
      {kind === 'video' && !item.uploading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}
      {item.uploading && (
        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!item.uploading && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          {...stopDrag}
          aria-label={t(`mediaOrder.${kind}Remove`)}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark rounded-full flex items-center justify-center text-white hover:bg-bark-light"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

/**
 * The photo or video thumbnails of the post dialogs, in the order they will
 * be saved. `kind` is 'photo' or 'video'. `children` renders after the tiles
 * (the add and camera buttons) and is not draggable.
 */
export default function SortableMediaTiles({ items, kind, onRemove, onMove, className = '', children }) {
  const { t } = useTranslation('memory')

  return (
    <>
      <SortableMediaGroup onMove={onMove}>
        <div className={`flex gap-3 flex-wrap ${className}`}>
          {items.map((item, i) => (
            <MediaTile
              key={item.id}
              item={item}
              kind={kind}
              index={i}
              items={items}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))}
          {children}
        </div>
      </SortableMediaGroup>
      {items.length > 1 && (
        <p className="text-xs text-bark-muted mt-1.5">{t(`mediaOrder.${kind}Hint`)}</p>
      )}
    </>
  )
}
