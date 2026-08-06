import { Fragment, useState } from 'react'
import { Play } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import EncryptedVideo from '../media/EncryptedVideo'
import { SingleMemoPlayer } from './VoiceMemoPlayer'
import { isRichDoc } from '../../utils/richText'

/**
 * Renders a rich memory description straight from its ProseMirror JSON.
 *
 * Deliberately not generateHTML() + dompurify: inline media are encrypted
 * Cloudinary `raw` blobs, so they have to be React components either way
 * (EncryptedImage and friends decrypt into object URLs). Walking the JSON keeps
 * TipTap out of the read bundle entirely and means no HTML string ever exists.
 *
 * That is not the same as being sanitizer-free — see safeHref below.
 */

// Link hrefs are user input. React does not reliably block `javascript:`, so
// this allowlist is the one deliberate sanitization point in the read path.
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:']

function safeHref(href) {
  if (typeof href !== 'string' || !href) return null
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://kaydo.app'
    return SAFE_PROTOCOLS.includes(new URL(href, base).protocol) ? href : null
  } catch {
    return null
  }
}

// Guards against a pathologically nested document costing an unbounded render.
const MAX_DEPTH = 12

function Marked({ node }) {
  let el = node.text || ''

  for (const mark of node.marks || []) {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        el = <strong className="font-semibold text-bark">{el}</strong>
        break
      case 'italic':
      case 'em':
        el = <em>{el}</em>
        break
      case 'strike':
        el = <s>{el}</s>
        break
      case 'underline':
        el = <u>{el}</u>
        break
      case 'code':
        el = <code className="px-1 py-0.5 rounded bg-cream-dark text-[0.9em]">{el}</code>
        break
      case 'link': {
        const href = safeHref(mark.attrs?.href)
        // No safe protocol: keep the words, drop the link.
        el = href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-kaydo underline underline-offset-2 hover:text-kaydo-dark"
          >
            {el}
          </a>
        ) : (
          el
        )
        break
      }
      default:
        break
    }
  }

  return el
}

/**
 * Inline videos are click-to-play on purpose. EncryptedVideo is not
 * IntersectionObserver-gated (see the comment in that file), so mounting five of
 * them at once would fetch and AES-decrypt five clips immediately, saturating
 * the shared decrypt pool and the object-URL cache. The poster costs nothing
 * until the reader actually wants the clip.
 */
function InlineVideo({ src, title }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <EncryptedVideo
        src={src}
        controls
        autoPlay
        playsInline
        className="w-full rounded-2xl bg-black max-h-[480px]"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={title || undefined}
      className="w-full aspect-video rounded-2xl bg-bark/90 flex items-center justify-center group"
    >
      <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition-colors">
        <Play className="w-6 h-6 text-bark ml-1" />
      </span>
    </button>
  )
}

function Caption({ text }) {
  if (!text) return null
  return <figcaption className="mt-2 text-sm text-bark-muted italic text-center">{text}</figcaption>
}

function renderChildren(nodes, depth) {
  return (nodes || []).map((child, i) => renderNode(child, i, depth + 1))
}

function renderNode(node, key, depth) {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return null

  switch (node.type) {
    case 'text':
      return <Fragment key={key}><Marked node={node} /></Fragment>

    case 'hardBreak':
      return <br key={key} />

    case 'paragraph':
      return (
        <p key={key} className="mb-4 leading-relaxed">
          {renderChildren(node.content, depth)}
        </p>
      )

    case 'heading': {
      // The memory title is the page's only h1, so headings start at h2.
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4)
      const Tag = `h${level}`
      const size = level === 2 ? 'text-2xl' : level === 3 ? 'text-xl' : 'text-lg'
      return (
        <Tag key={key} className={`${size} font-serif font-bold text-bark mt-8 mb-3`}>
          {renderChildren(node.content, depth)}
        </Tag>
      )
    }

    case 'bulletList':
      return (
        <ul key={key} className="list-disc pl-6 mb-4 space-y-1">
          {renderChildren(node.content, depth)}
        </ul>
      )

    case 'orderedList':
      return (
        <ol key={key} className="list-decimal pl-6 mb-4 space-y-1" start={node.attrs?.start || 1}>
          {renderChildren(node.content, depth)}
        </ol>
      )

    case 'listItem':
      return (
        // The list item's own margin would double up with its paragraph's.
        <li key={key} className="[&>p]:mb-0 leading-relaxed">
          {renderChildren(node.content, depth)}
        </li>
      )

    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-4 border-kaydo pl-5 my-6 italic text-bark-light [&>p:last-child]:mb-0"
        >
          {renderChildren(node.content, depth)}
        </blockquote>
      )

    case 'codeBlock':
      return (
        <pre key={key} className="mb-4 p-4 rounded-xl bg-cream-dark overflow-x-auto text-sm">
          <code>{renderChildren(node.content, depth)}</code>
        </pre>
      )

    case 'horizontalRule':
      return <hr key={key} className="my-8 border-cream-dark" />

    case 'encryptedImage':
      if (!node.attrs?.src) return null
      return (
        <figure key={key} className="my-6">
          <EncryptedImage
            src={node.attrs.src}
            thumbSrc={node.attrs.thumbSrc}
            alt={node.attrs.alt || node.attrs.caption || ''}
            className="w-full rounded-2xl"
          />
          <Caption text={node.attrs.caption} />
        </figure>
      )

    case 'encryptedVideo':
      if (!node.attrs?.src) return null
      return (
        <figure key={key} className="my-6">
          <InlineVideo src={node.attrs.src} title={node.attrs.title} />
          <Caption text={node.attrs.caption || node.attrs.title} />
        </figure>
      )

    case 'encryptedAudio':
      if (!node.attrs?.src) return null
      return (
        <div key={key} className="my-6">
          <SingleMemoPlayer
            memo={{
              url: node.attrs.src,
              title: node.attrs.title,
              duration: node.attrs.duration || 0,
            }}
          />
        </div>
      )

    // Unknown node types render nothing, which is what lets a document written
    // by a newer client stay readable on an older one.
    default:
      return null
  }
}

export default function RichContent({ doc, className = '' }) {
  if (!isRichDoc(doc)) return null

  return (
    <div className={`text-bark-light text-lg leading-relaxed ${className}`}>
      {renderChildren(doc.content, 0)}
    </div>
  )
}
