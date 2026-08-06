import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageNodeView, VideoNodeView, AudioNodeView } from './MediaNodeViews'

/**
 * The three inline media nodes of a rich memory description.
 *
 * They are atoms: the editor treats each as one indivisible block, and the
 * caption is an attribute edited through the NodeView rather than editable
 * inline content. That keeps richToPlainText() and the read-path renderer able
 * to reach the caption without walking into the node.
 *
 * `src` holds the encrypted Cloudinary URL. It is empty while the upload is in
 * flight; the blob: preview lives in previewStore, never here.
 */

// Attributes round-trip through data-* on purpose. ProseMirror serializes
// through the HTML layer when you copy or paste *within* the editor, even
// though we never call getHTML() — without these, reordering a photo by
// cut-and-paste would silently strip its URL and caption.
const dataAttr = (name, fallback = null) => ({
  default: fallback,
  parseHTML: (element) => element.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attributes) =>
    attributes[name] == null || attributes[name] === '' ? {} : { [`data-${name}`]: attributes[name] },
})

/**
 * Insert a media node and leave the cursor in a fresh paragraph after it.
 *
 * The trailing paragraph is not cosmetic. Inserting an atom leaves a
 * NodeSelection on it, so a second insertContent at the same selection
 * *replaces* the first node instead of appending — picking three photos at once
 * would keep only the third. Moving the cursor past the node also means the
 * writer can simply carry on typing under the photo.
 */
function insertMedia(type) {
  return (attributes) =>
    ({ commands }) =>
      commands.insertContent([{ type, attrs: attributes }, { type: 'paragraph' }])
}

function mediaNode({ name, tag, attrs, nodeView }) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes: () => attrs,

    parseHTML: () => [{ tag: `div[data-type="${tag}"]` }],

    renderHTML: ({ HTMLAttributes }) =>
      ['div', mergeAttributes(HTMLAttributes, { 'data-type': tag })],

    addNodeView: () => ReactNodeViewRenderer(nodeView),
  })
}

export const EncryptedImageNode = mediaNode({
  name: 'encryptedImage',
  tag: 'encrypted-image',
  nodeView: ImageNodeView,
  attrs: {
    src: dataAttr('src', ''),
    publicId: dataAttr('publicId'),
    thumbSrc: dataAttr('thumbSrc'),
    thumbPublicId: dataAttr('thumbPublicId'),
    alt: dataAttr('alt'),
    caption: dataAttr('caption', ''),
    // Transient: only set while the upload is in flight, cleared on success.
    uploadId: dataAttr('uploadId'),
  },
}).extend({
  addCommands() {
    return { insertEncryptedImage: insertMedia('encryptedImage') }
  },
})

export const EncryptedVideoNode = mediaNode({
  name: 'encryptedVideo',
  tag: 'encrypted-video',
  nodeView: VideoNodeView,
  attrs: {
    src: dataAttr('src', ''),
    publicId: dataAttr('publicId'),
    caption: dataAttr('caption', ''),
    title: dataAttr('title'),
    uploadId: dataAttr('uploadId'),
  },
}).extend({
  addCommands() {
    return { insertEncryptedVideo: insertMedia('encryptedVideo') }
  },
})

export const EncryptedAudioNode = mediaNode({
  name: 'encryptedAudio',
  tag: 'encrypted-audio',
  nodeView: AudioNodeView,
  attrs: {
    src: dataAttr('src', ''),
    publicId: dataAttr('publicId'),
    title: dataAttr('title', ''),
    duration: {
      default: 0,
      parseHTML: (element) => Number(element.getAttribute('data-duration')) || 0,
      renderHTML: (attributes) =>
        attributes.duration ? { 'data-duration': attributes.duration } : {},
    },
  },
}).extend({
  addCommands() {
    return { insertEncryptedAudio: insertMedia('encryptedAudio') }
  },
})

export const mediaExtensions = [EncryptedImageNode, EncryptedVideoNode, EncryptedAudioNode]
