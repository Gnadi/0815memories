/**
 * What a document says about the files it uses — src/services/mediaRefs.js.
 *
 * The server deletes files no document names, and cannot read rich text, so
 * what is worked out here before encryption is what keeps a family's photos.
 * The partial-write cases matter most: an update that changes only the title
 * must leave the photos' entries alone.
 */
import { describe, it, expect } from 'vitest'
import { deleteField, serverTimestamp } from '../config/firestore'
import { mediaIdsIn, mediaRefsForCreate, mediaRefsForMerge, mediaRefsForUpdate } from '../services/mediaRefs'

const id = (c) => `kaydo/fam-1/${c.repeat(32)}`
const url = (c) => `https://res.cloudinary.com/demo/raw/upload/v1700000000/${id(c)}`
const isDeletion = (v) => v?.isEqual?.(deleteField()) === true

describe('mediaIdsIn', () => {
  it('finds ids in URLs, bare, in lists and maps, and inside a JSON string', () => {
    const rich = JSON.stringify({ type: 'doc', content: [{ type: 'encryptedImage', attrs: { src: url('c'), publicId: id('c') } }] })
    expect(mediaIdsIn({ images: [url('a')], thumbPublicId: id('b'), contentRich: rich })).toEqual([id('a'), id('b'), id('c')])
  })

  it('finds a picture shown without the key, extension and all', () => {
    expect(mediaIdsIn(`https://res.cloudinary.com/demo/image/upload/v1/kaydo/public/fam-1/${'d'.repeat(32)}.jpg`))
      .toEqual([`kaydo/public/fam-1/${'d'.repeat(32)}`])
  })

  it('names files from before the ledger by resource type and public id', () => {
    expect(mediaIdsIn([
      'https://res.cloudinary.com/demo/raw/upload/v1/kaydo/encrypted/abcdefghij0123456789.dat',
      'https://res.cloudinary.com/demo/image/upload/kaydo/header1.jpg',
      JSON.stringify({ src: 'https://res.cloudinary.com/demo/video/upload/v2/kaydo/videos/clip.mp4' }),
    ])).toEqual([
      'legacy:image/kaydo/header1',
      'legacy:raw/kaydo/encrypted/abcdefghij0123456789.dat',
      'legacy:video/kaydo/videos/clip',
    ])
  })

  it('names a file signUpload made by its id only, not again as a legacy one', () => {
    expect(mediaIdsIn(`https://res.cloudinary.com/demo/image/upload/v1/kaydo/public/fam-1/${'d'.repeat(32)}.jpg`))
      .toEqual([`kaydo/public/fam-1/${'d'.repeat(32)}`])
  })

  it('leaves out anything that only looks close', () => {
    expect(mediaIdsIn([
      `kaydo/fam-1/${'a'.repeat(31)}`,
      `kaydo/fam-1/${'a'.repeat(33)}`,
      'https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill/kaydo/a.jpg',
      'https://res.cloudinary.com/demo/raw/upload/encrypted.dat',
      'blob:https://kaydo.app/1234',
    ])).toEqual([])
  })

  it('names each file once', () => {
    expect(mediaIdsIn([url('a'), id('a'), { again: url('a') }])).toEqual([id('a')])
  })
})

describe('mediaRefsForCreate', () => {
  it('keeps an entry for every field with media, and none for the rest', () => {
    expect(mediaRefsForCreate({ title: 'Summer', images: [url('a')], thumbs: [url('b')], createdAt: serverTimestamp() }))
      .toEqual({ mediaRefs: { images: [id('a')], thumbs: [id('b')] } })
  })

  it('is an empty map for a document without media', () => {
    expect(mediaRefsForCreate({ title: 'Summer' })).toEqual({ mediaRefs: {} })
  })

  it('does not copy the entries of a document it was made from', () => {
    expect(mediaRefsForCreate({ mediaRefs: { images: [id('z')] }, images: [url('a')] }))
      .toEqual({ mediaRefs: { images: [id('a')] } })
  })
})

describe('mediaRefsForUpdate', () => {
  it('replaces the entries of exactly the fields written', () => {
    const paths = mediaRefsForUpdate({ images: [url('a')], title: 'New title' })
    expect(paths['mediaRefs.images']).toEqual([id('a')])
    // The title holds no media: its entry, if it ever had one, goes.
    expect(isDeletion(paths['mediaRefs.title'])).toBe(true)
    expect(Object.keys(paths).sort()).toEqual(['mediaRefs.images', 'mediaRefs.title'])
  })

  it('leaves alone what cannot hold media', () => {
    expect(mediaRefsForUpdate({ updatedAt: serverTimestamp(), pageCount: 3, isFavorite: true })).toEqual({})
  })

  it('lets go of a field that is cleared', () => {
    const paths = mediaRefsForUpdate({ contentRich: null, instructionsRich: deleteField() })
    expect(isDeletion(paths['mediaRefs.contentRich'])).toBe(true)
    expect(isDeletion(paths['mediaRefs.instructionsRich'])).toBe(true)
  })
})

describe('mediaRefsForMerge', () => {
  it('nests the same entries for setDoc with merge', () => {
    const { mediaRefs } = mediaRefsForMerge({ loginHeaderImage: url('a'), familyName: 'Millers' })
    expect(mediaRefs.loginHeaderImage).toEqual([id('a')])
    expect(isDeletion(mediaRefs.familyName)).toBe(true)
  })
})
