/**
 * The three inline media nodes, driven through a real headless editor.
 *
 * Scoped deliberately: this does not test typing, selection or the React
 * NodeViews — ProseMirror's DOM work is a poor fit for jsdom. It tests the two
 * things that are pure schema and command behaviour, and that both broke in
 * development:
 *
 *  - consecutive inserts must append, not replace. Inserting an atom leaves a
 *    NodeSelection on it, so the naive insertContent() dropped every photo but
 *    the last one when several files were picked at once;
 *  - attributes must round-trip through HTML, because ProseMirror serializes
 *    that way when you copy or paste inside the editor, even though the app
 *    never calls getHTML().
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { mediaExtensions } from '../components/admin/richTextEditor/mediaNodes'
import { collectRichMediaUrls, richToPlainText } from '../utils/richText'

// jsdom has no layout engine; ProseMirror only needs these to exist.
beforeAll(() => {
  Range.prototype.getClientRects ||= () => []
  Range.prototype.getBoundingClientRect ||= () => ({ top: 0, left: 0, width: 0, height: 0 })
})

const makeEditor = (content) =>
  new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: 'x' }),
      ...mediaExtensions,
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
  })

describe('rich editor media nodes', () => {
  it('builds with the extension set the app actually uses', () => {
    const editor = makeEditor()
    expect(editor.getJSON().type).toBe('doc')
    editor.destroy()
  })

  it('appends consecutive media instead of replacing the previous node', () => {
    const editor = makeEditor()
    // The multi-file photo picker takes exactly this path.
    editor.commands.insertEncryptedImage({ src: 'https://x/1', uploadId: null })
    editor.commands.insertEncryptedImage({ src: 'https://x/2', uploadId: null })
    editor.commands.insertEncryptedVideo({ src: 'https://x/3' })
    editor.commands.insertEncryptedAudio({ src: 'https://x/4', title: 'Opa', duration: 12 })

    expect(collectRichMediaUrls(editor.getJSON())).toEqual([
      { kind: 'image', url: 'https://x/1' },
      { kind: 'image', url: 'https://x/2' },
      { kind: 'video', url: 'https://x/3' },
      { kind: 'audio', url: 'https://x/4' },
    ])
    editor.destroy()
  })

  it('round-trips every attribute through HTML, as copy/paste does', () => {
    const editor = makeEditor()
    editor.commands.insertEncryptedImage({
      src: 'https://x/a',
      publicId: 'kaydo/encrypted/a',
      thumbSrc: 'https://x/a-thumb',
      thumbPublicId: 'kaydo/encrypted/a-thumb',
      caption: 'Oma am See',
    })

    const html = editor.getHTML()
    editor.destroy()

    const reparsed = makeEditor(html)
    const node = reparsed.getJSON().content.find((n) => n.type === 'encryptedImage')
    reparsed.destroy()

    expect(node.attrs).toMatchObject({
      src: 'https://x/a',
      publicId: 'kaydo/encrypted/a',
      thumbSrc: 'https://x/a-thumb',
      thumbPublicId: 'kaydo/encrypted/a-thumb',
      caption: 'Oma am See',
    })
  })

  it('produces a document the plain-text mirror can flatten', () => {
    const editor = makeEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Der Sommer bei Oma' }] },
        { type: 'encryptedImage', attrs: { src: 'https://x/a', caption: 'Am See' } },
      ],
    })
    expect(richToPlainText(editor.getJSON())).toBe('Der Sommer bei Oma\n\nAm See')
    editor.destroy()
  })

  it('keeps the caption out of the editable content, so it stays an attribute', () => {
    const editor = makeEditor()
    editor.commands.insertEncryptedImage({ src: 'https://x/a', caption: 'Am See' })
    const node = editor.getJSON().content.find((n) => n.type === 'encryptedImage')
    expect(node.content).toBeUndefined()
    expect(node.attrs.caption).toBe('Am See')
    editor.destroy()
  })
})
