import { useTranslation } from 'react-i18next'
import { useEditorState } from '@tiptap/react'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  Video,
  Mic,
  Camera,
} from 'lucide-react'

function ToolButton({ onClick, active, label, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={`min-w-11 min-h-11 px-2 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 ${
        active ? 'bg-kaydo text-white' : 'text-bark-light hover:bg-cream-dark'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-6 bg-cream-dark flex-shrink-0 mx-0.5" aria-hidden="true" />
}

export default function RichTextToolbar({
  editor,
  disabled,
  onPickImage,
  onTakePhoto,
  onPickVideo,
  onAddAudio,
}) {
  const { t } = useTranslation('memory')

  // A selector rather than editor.isActive() in render: this re-runs on
  // selection change without re-rendering the toolbar on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            link: e.isActive('link'),
          }
        : {},
  })

  if (!editor) return null

  const chain = () => editor.chain().focus()

  const toggleLink = () => {
    if (state.link) {
      chain().unsetLink().run()
      return
    }
    const url = window.prompt(t('richEditor.linkPrompt'))
    if (!url) return
    chain().setLink({ href: url }).run()
  }

  return (
    <div
      // Sits below the modal header, which is itself sticky at z-10.
      className="sticky top-0 z-[5] flex items-center gap-0.5 overflow-x-auto bg-warm-white border-b border-cream-dark px-1 py-1 rounded-t-xl"
    >
      <ToolButton
        onClick={() => chain().toggleBold().run()}
        active={state.bold}
        label={t('richEditor.bold')}
        disabled={disabled}
      >
        <Bold className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => chain().toggleItalic().run()}
        active={state.italic}
        label={t('richEditor.italic')}
        disabled={disabled}
      >
        <Italic className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
        active={state.h2}
        label={t('richEditor.heading2')}
        disabled={disabled}
      >
        <Heading2 className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
        active={state.h3}
        label={t('richEditor.heading3')}
        disabled={disabled}
      >
        <Heading3 className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        onClick={() => chain().toggleBulletList().run()}
        active={state.bullet}
        label={t('richEditor.bulletList')}
        disabled={disabled}
      >
        <List className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => chain().toggleOrderedList().run()}
        active={state.ordered}
        label={t('richEditor.orderedList')}
        disabled={disabled}
      >
        <ListOrdered className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => chain().toggleBlockquote().run()}
        active={state.quote}
        label={t('richEditor.quote')}
        disabled={disabled}
      >
        <Quote className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={toggleLink}
        active={state.link}
        label={state.link ? t('richEditor.unlink') : t('richEditor.link')}
        disabled={disabled}
      >
        <Link2 className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton onClick={onPickImage} label={t('richEditor.insertPhoto')} disabled={disabled}>
        <ImageIcon className="w-4 h-4 text-kaydo" />
      </ToolButton>
      {/* Camera capture only makes sense on a phone. */}
      <span className="lg:hidden flex">
        <ToolButton onClick={onTakePhoto} label={t('richEditor.takePhoto')} disabled={disabled}>
          <Camera className="w-4 h-4 text-kaydo" />
        </ToolButton>
      </span>
      <ToolButton onClick={onPickVideo} label={t('richEditor.insertVideo')} disabled={disabled}>
        <Video className="w-4 h-4 text-kaydo" />
      </ToolButton>
      <ToolButton onClick={onAddAudio} label={t('richEditor.insertAudio')} disabled={disabled}>
        <Mic className="w-4 h-4 text-kaydo" />
      </ToolButton>
    </div>
  )
}
