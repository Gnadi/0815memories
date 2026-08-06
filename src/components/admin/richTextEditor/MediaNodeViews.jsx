import { NodeViewWrapper } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { Trash2, Mic, Loader2 } from 'lucide-react'
import EncryptedImage from '../../media/EncryptedImage'
import EncryptedVideo from '../../media/EncryptedVideo'
import { getPreview } from './previewStore'

/**
 * Editor-side rendering of the three inline media nodes.
 *
 * While `src` is empty the asset is still uploading and the local blob preview
 * comes from previewStore (never from the document — see that file). Once the
 * upload lands, the same node renders through the encrypted media components,
 * exactly as the reader will see it.
 */

function Shell({ children, onRemove, removeLabel }) {
  return (
    // contentEditable={false} keeps ProseMirror from putting a text cursor
    // inside the node's UI and fighting the caption input for focus.
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className="relative group rounded-2xl overflow-hidden">
        {children}
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-bark/80 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </NodeViewWrapper>
  )
}

function Uploading() {
  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
      <Loader2 className="w-7 h-7 text-white animate-spin" />
    </div>
  )
}

function CaptionInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      // draggable={false} so selecting text in the caption does not start a
      // node drag instead.
      draggable={false}
      className="w-full mt-2 px-3 py-2 bg-cream-dark rounded-xl text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
    />
  )
}

export function ImageNodeView({ node, updateAttributes, deleteNode }) {
  const { t } = useTranslation('memory')
  const { src, thumbSrc, caption, uploadId } = node.attrs
  const preview = getPreview(uploadId)

  return (
    <>
      <Shell onRemove={deleteNode} removeLabel={t('richEditor.removeMedia')}>
        {src ? (
          <EncryptedImage
            src={src}
            thumbSrc={thumbSrc}
            alt={caption || ''}
            className="w-full rounded-2xl"
          />
        ) : (
          <div className="relative">
            {preview ? (
              <img src={preview} alt="" className="w-full rounded-2xl" />
            ) : (
              <div className="w-full aspect-video bg-cream-dark rounded-2xl" />
            )}
            <Uploading />
          </div>
        )}
      </Shell>
      <CaptionInput
        value={caption}
        onChange={(value) => updateAttributes({ caption: value })}
        placeholder={t('richEditor.captionPlaceholder')}
      />
    </>
  )
}

export function VideoNodeView({ node, updateAttributes, deleteNode }) {
  const { t } = useTranslation('memory')
  const { src, caption, uploadId } = node.attrs
  const preview = getPreview(uploadId)

  return (
    <>
      <Shell onRemove={deleteNode} removeLabel={t('richEditor.removeMedia')}>
        {src ? (
          <EncryptedVideo src={src} controls playsInline className="w-full rounded-2xl bg-black" />
        ) : (
          <div className="relative">
            {preview ? (
              <video src={preview} muted playsInline className="w-full rounded-2xl bg-black" />
            ) : (
              <div className="w-full aspect-video bg-cream-dark rounded-2xl" />
            )}
            <Uploading />
          </div>
        )}
      </Shell>
      <CaptionInput
        value={caption}
        onChange={(value) => updateAttributes({ caption: value })}
        placeholder={t('richEditor.captionPlaceholder')}
      />
    </>
  )
}

export function AudioNodeView({ node, updateAttributes, deleteNode }) {
  const { t } = useTranslation('memory')
  const { title, duration } = node.attrs

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className="flex items-center gap-3 bg-cream-dark rounded-xl px-4 py-3">
        <Mic className="w-4 h-4 text-kaydo flex-shrink-0" />
        <input
          type="text"
          value={title || ''}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder={t('richEditor.captionPlaceholder')}
          draggable={false}
          className="flex-1 min-w-0 px-3 py-1.5 bg-warm-white rounded-lg text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
        />
        {duration > 0 && (
          <span className="text-xs text-bark-muted tabular-nums flex-shrink-0">
            {formatTime(duration)}
          </span>
        )}
        <button
          type="button"
          onClick={deleteNode}
          aria-label={t('richEditor.removeMedia')}
          className="text-bark-muted hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </NodeViewWrapper>
  )
}
