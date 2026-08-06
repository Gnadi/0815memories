import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { X, Minimize2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { encryptAndUpload, encryptAndUploadWithThumb } from '../../utils/encryptedUpload'
import { getVideoDuration } from '../../hooks/useMediaUploader'
import { MAX_VIDEO_DURATION_SECONDS } from '../../constants/media'
import { devError } from '../../utils/devLog'
import { EMPTY_RICH_DOC, isRichDoc } from '../../utils/richText'
import VoiceMemoRecorder from './VoiceMemoRecorder'
import RichTextToolbar from './richTextEditor/RichTextToolbar'
import { mediaExtensions } from './richTextEditor/mediaNodes'
import { newUploadId, patchByUploadId, removeByUploadId } from './richTextEditor/nodeUtils'
import { setPreview, clearPreview, clearAllPreviews } from './richTextEditor/previewStore'

/**
 * The rich description editor.
 *
 * This is the only module in the app that imports @tiptap/*. It is reached
 * exclusively through RichTextEditorLazy so the editor lands in its own chunk —
 * see that file for why that matters here specifically.
 *
 * Media inserted from the toolbar goes in at the cursor immediately as an empty
 * node plus a local preview, and its attributes are filled in when the
 * encrypted upload resolves. `onPendingChange` reports how many uploads are in
 * flight so the surrounding form can block saving until they land.
 */
export default function RichTextEditor({ value, onChange, onPendingChange, disabled = false }) {
  const { t } = useTranslation('memory')
  const { encryptionKey } = useAuth()

  const [showRecorder, setShowRecorder] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const imageInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const editor = useEditor({
    // Never render during a Node pre-render pass. Only "/" is prerendered today
    // (see includedRoutes in src/main.jsx), but this costs nothing.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // The memory title is the page's only h1, so the editor offers h2/h3.
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: t('richEditor.placeholder') }),
      ...mediaExtensions,
    ],
    content: isRichDoc(value) ? value : EMPTY_RICH_DOC,
    editorProps: {
      attributes: { class: 'kaydo-editor focus:outline-none min-h-[200px] px-4 py-3' },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
  })

  useEffect(() => () => clearAllPreviews(), [])

  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // Escape leaves fullscreen. The event is stopped so it cannot also reach a
  // future modal-level Escape handler and close the whole form, losing the draft.
  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setFullscreen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    // The modal behind stays scrollable otherwise, which on a phone means the
    // page drifts under the editor while you type.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [fullscreen])

  const toggleFullscreen = () => {
    setFullscreen((v) => !v)
    // Keep the caret where the writer left it rather than dropping focus on the
    // way in or out.
    requestAnimationFrame(() => editor?.commands.focus())
  }

  /**
   * Insert a placeholder node now, upload, then patch the node.
   *
   * Deliberately not awaited by the caller: the point is that the placeholder
   * shows up the instant the file is picked.
   */
  const insertUploadedMedia = useCallback(
    async ({ file, insert, upload, attrsFromResult }) => {
      if (!editor) return
      const uploadId = newUploadId()
      setPreview(uploadId, URL.createObjectURL(file))
      insert(uploadId)
      setPending((n) => n + 1)
      setError('')

      try {
        const result = await upload(file)
        // uploadId back to null so the node is no longer "pending".
        patchByUploadId(editor, uploadId, { ...attrsFromResult(result), uploadId: null })
      } catch (err) {
        devError('Inline media upload failed:', err)
        removeByUploadId(editor, uploadId)
        setError(t('richEditor.uploadFailed'))
      } finally {
        clearPreview(uploadId)
        setPending((n) => n - 1)
      }
    },
    [editor, t]
  )

  const handleImagePick = async (e, inputRef) => {
    const files = Array.from(e.target.files || [])
    if (inputRef?.current) inputRef.current.value = ''
    for (const file of files) {
      insertUploadedMedia({
        file,
        insert: (uploadId) =>
          editor.chain().focus().insertEncryptedImage({ src: '', uploadId }).run(),
        upload: (f) => encryptAndUploadWithThumb(f, encryptionKey),
        attrsFromResult: ({ url, publicId, thumbUrl, thumbPublicId }) => ({
          src: url,
          publicId,
          thumbSrc: thumbUrl || null,
          thumbPublicId: thumbPublicId || null,
        }),
      })
    }
  }

  const handleVideoPick = async (e, inputRef) => {
    const file = e.target.files?.[0]
    if (inputRef?.current) inputRef.current.value = ''
    if (!file) return

    // Same cap as the separate video section, checked before anything uploads.
    const duration = await getVideoDuration(file)
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      setError(t('richEditor.videoTooLong', { seconds: MAX_VIDEO_DURATION_SECONDS }))
      return
    }

    insertUploadedMedia({
      file,
      insert: (uploadId) =>
        editor.chain().focus().insertEncryptedVideo({ src: '', uploadId }).run(),
      upload: (f) => encryptAndUpload(f, encryptionKey),
      attrsFromResult: ({ url, publicId }) => ({ src: url, publicId }),
    })
  }

  // VoiceMemoRecorder uploads before it calls back, so inline audio needs no
  // placeholder or preview at all — the node arrives complete.
  const handleMemoAdded = (memo) => {
    editor
      ?.chain()
      .focus()
      .insertEncryptedAudio({
        src: memo.url,
        publicId: memo.publicId,
        title: memo.title || '',
        duration: memo.duration || 0,
      })
      .run()
    setShowRecorder(false)
  }

  return (
    // Fullscreen is a plain fixed overlay rather than a portal: the component
    // stays inside the form, so nothing about saving or focus order changes.
    // z-[60] clears the modal at z-50, the highest layer in the app.
    <div
      className={
        fullscreen
          ? 'kaydo-fullscreen fixed inset-0 z-[60] bg-warm-white flex flex-col'
          : 'rounded-xl bg-cream-dark/60 border border-cream-dark overflow-hidden'
      }
    >
      {fullscreen && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cream-dark flex-shrink-0">
          <span className="text-sm font-medium text-bark">{t('postMemory.storyLabel')}</span>
          {/* The save button lives in the form below, out of reach from here —
              so this has to read as "back to the form", not as "discard". */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream-dark text-sm font-medium text-bark hover:bg-cream-dark/70 transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
            {t('richEditor.doneEditing')}
          </button>
        </div>
      )}

      <RichTextToolbar
        editor={editor}
        disabled={disabled}
        onPickImage={() => imageInputRef.current?.click()}
        onTakePhoto={() => cameraInputRef.current?.click()}
        onPickVideo={() => videoInputRef.current?.click()}
        onAddAudio={() => setShowRecorder((v) => !v)}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {fullscreen ? (
        <div className="flex-1 overflow-y-auto">
          {/* Same measure as the reading view (MemoryBody), so the line length
              the writer sees is the line length the family will read. */}
          <div className="max-w-2xl mx-auto w-full px-2 py-6">
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}

      {showRecorder && (
        <div className="p-3 border-t border-cream-dark flex-shrink-0">
          <VoiceMemoRecorder onMemoAdded={handleMemoAdded} />
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 px-4 py-2 text-xs text-red-600 border-t border-cream-dark flex-shrink-0">
          <X className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </p>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleImagePick(e, imageInputRef)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleImagePick(e, cameraInputRef)}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleVideoPick(e, videoInputRef)}
        className="hidden"
      />
    </div>
  )
}
