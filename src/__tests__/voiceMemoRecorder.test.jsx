/**
 * Recording a voice memo.
 *
 * Three ways it used to go wrong: the production Permissions-Policy header
 * denied the microphone outright, so recording never started; the recording
 * was labelled audio/webm whatever the browser produced, which Safari (MP4)
 * then would not play back; and closing the dialog mid-recording left the
 * microphone on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ encryptionKey: 'key' }) }))

const mockUpload = vi.fn(async () => ({ url: 'https://cdn/memo.enc', publicId: 'memo' }))
vi.mock('../utils/encryptedUpload', () => ({ encryptAndUpload: (...args) => mockUpload(...args) }))

const VoiceMemoRecorder = (await import('../components/admin/VoiceMemoRecorder')).default

let track

/** What Safari's MediaRecorder does: records MP4, and says so. */
class SafariMediaRecorder {
  constructor(stream) {
    this.stream = stream
    this.state = 'inactive'
    this.mimeType = 'audio/mp4'
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['aac'], { type: 'audio/mp4' }) })
    this.onstop?.()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  track = { stop: vi.fn() }
  globalThis.MediaRecorder = SafariMediaRecorder
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) },
  })
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  delete globalThis.MediaRecorder
})

describe('VoiceMemoRecorder', () => {
  it('keeps the type the browser actually recorded', async () => {
    const user = userEvent.setup()
    render(<VoiceMemoRecorder onMemoAdded={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Record' }))
    await user.click(await screen.findByRole('button', { name: 'Stop' }))
    await user.click(await screen.findByRole('button', { name: 'Add to memory' }))

    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0][0].type).toBe('audio/mp4')
    // The preview's object URL is released once the memo is handed over.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('turns the microphone off when it is closed mid-recording', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<VoiceMemoRecorder onMemoAdded={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    unmount()

    expect(track.stop).toHaveBeenCalled()
  })

  it('is allowed the microphone by the production headers', () => {
    // `microphone=()` in vercel.json denied getUserMedia on every page, so in
    // production the recorder could only ever say "access denied".
    const config = JSON.parse(readFileSync(join(globalThis.process.cwd(), 'vercel.json'), 'utf8'))
    const policy = config.headers
      .flatMap((rule) => rule.headers)
      .find((header) => header.key.toLowerCase() === 'permissions-policy')?.value ?? ''
    const microphone = /(?:^|,)\s*microphone=\(([^)]*)\)/.exec(policy)
    expect(microphone, 'no microphone directive: the browser default applies').not.toBeNull()
    expect(microphone[1].split(/\s+/)).toContain('self')
  })
})
