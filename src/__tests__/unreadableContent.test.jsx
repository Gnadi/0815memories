/**
 * A field that does not decrypt shows as missing, and is said to be missing.
 *
 * utils/encryption.js used to hand back whatever did not decrypt, which put a
 * wrong key's base64 on screen as if it were the text. Now the field is null,
 * the document lists it in `unreadableFields`, a list keeps its other
 * documents, and the app says once that something could not be read.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { webcrypto } from 'node:crypto'

vi.mock('../config/firebase', () => ({ db: {} }))
const snapshots = vi.hoisted(() => ({ emit: null }))
vi.mock('../config/firestore', () => ({
  onSnapshot: (_source, next) => {
    snapshots.emit = next
    return () => {}
  },
  doc: vi.fn(),
  getDoc: vi.fn(),
}))
vi.mock('../components/memory/VoiceMemoPlayer', () => ({ default: () => null }))
vi.mock('../components/memory/MemoryVideoPlayer', () => ({ default: () => null }))

import { clearDecryptedTextCache, decryptFields, encryptText, generateEncryptionKey } from '../utils/encryption'
import { subscribeDecrypted } from '../services/decrypted'
import MemoryBody from '../components/memory/MemoryBody'
import UnreadableContentNotice from '../components/UnreadableContentNotice'

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

let key
beforeEach(async () => {
  clearDecryptedTextCache()
  if (!key) ({ key } = await generateEncryptionKey())
})

describe('a list with one damaged document', () => {
  it('still delivers every document, the damaged one without its field', async () => {
    const onData = vi.fn()
    const onError = vi.fn()
    subscribeDecrypted({}, (docs) => Promise.all(docs.map((d) => decryptFields(key, d, ['title']))), onData, onError)

    const good = { id: 'a', title: await encryptText(key, 'Sommer') }
    const damaged = { id: 'b', title: 'damaged' }
    await snapshots.emit({ docs: [good, damaged].map(({ id, ...data }) => ({ id, data: () => data })) })

    expect(onError).not.toHaveBeenCalled()
    expect(onData).toHaveBeenCalledWith([
      { id: 'a', title: 'Sommer' },
      { id: 'b', title: null, unreadableFields: ['title'] },
    ])
  })
})

describe('MemoryBody', () => {
  it('says the description could not be read when neither it nor its mirror decrypted', () => {
    render(<MemoryBody memory={{ title: 'Sommer', content: null, unreadableFields: ['content', 'contentRich'] }} />)
    expect(screen.getByText('This content could not be decrypted.')).toBeInTheDocument()
  })

  it('says nothing when only the rich document failed and the mirror is there', () => {
    render(<MemoryBody memory={{ title: 'Sommer', content: 'Am See', contentRich: null, unreadableFields: ['contentRich'] }} />)
    expect(screen.getByText('Am See')).toBeInTheDocument()
    expect(screen.queryByText('This content could not be decrypted.')).not.toBeInTheDocument()
  })
})

describe('UnreadableContentNotice', () => {
  it('appears once something did not decrypt, and stays closed until more does', async () => {
    render(<UnreadableContentNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await act(() => decryptFields(key, { title: 'damaged' }, ['title']))
    expect(screen.getByRole('status')).toHaveTextContent('One entry could not be decrypted')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await act(() => decryptFields(key, { title: 'damaged again' }, ['title']))
    expect(screen.getByRole('status')).toHaveTextContent('2 entries could not be decrypted')
  })

  it('starts over with a new session or family', async () => {
    render(<UnreadableContentNotice />)
    await act(() => decryptFields(key, { title: 'damaged' }, ['title']))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    act(() => clearDecryptedTextCache())
    await act(() => decryptFields(key, { title: 'damaged' }, ['title']))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
