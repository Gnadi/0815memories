import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// The upload helpers are the only side-effect we care about; mocking them at
// module-load time keeps the hook isolated from Cloudinary + Web Crypto.
// Images go through encryptAndUploadWithThumb, videos through encryptAndUpload.
vi.mock('../utils/encryptedUpload', () => ({
  encryptAndUpload: vi.fn(),
  encryptAndUploadWithThumb: vi.fn(),
}))
vi.mock('../utils/devLog', () => ({
  devError: vi.fn(),
  devWarn: vi.fn(),
}))

import { encryptAndUpload, encryptAndUploadWithThumb } from '../utils/encryptedUpload'
import { useMediaUploader } from '../hooks/useMediaUploader'
import { MAX_PLAINTEXT_BYTES } from '../constants/media'

// jsdom's URL.createObjectURL is absent by default.
beforeEach(() => {
  encryptAndUpload.mockReset()
  encryptAndUploadWithThumb.mockReset()
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
  }
})

function makeFile(name = 'pic.jpg', type = 'image/jpeg', size) {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type })
  if (size != null) Object.defineProperty(file, 'size', { value: size })
  return file
}

// getVideoDuration spawns a hidden <video> and reads .duration once
// `loadedmetadata` fires. In jsdom neither happens naturally, so the prototype's
// `duration` getter and `src` setter are overridden to invoke the callback
// synchronously with a chosen value. Returns a restore function.
function stubVideoDuration(seconds) {
  const originalDuration = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')
  const originalSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get() { return seconds },
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    set() { queueMicrotask(() => this.onloadedmetadata?.()) },
  })
  return () => {
    if (originalDuration) Object.defineProperty(HTMLMediaElement.prototype, 'duration', originalDuration)
    if (originalSrc) Object.defineProperty(HTMLMediaElement.prototype, 'src', originalSrc)
  }
}

describe('useMediaUploader', () => {
  it('adds an image with a temp entry, then swaps in the uploaded URL', async () => {
    encryptAndUploadWithThumb.mockResolvedValue({
      url: 'https://cdn/example.enc',
      publicId: 'pub123',
      thumbUrl: 'https://cdn/example-thumb.enc',
      thumbPublicId: 'pub123-thumb',
    })
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    await act(async () => {
      await result.current.addImage(makeFile())
    })

    expect(result.current.images).toHaveLength(1)
    expect(result.current.images[0].url).toBe('https://cdn/example.enc')
    expect(result.current.images[0].publicId).toBe('pub123')
    expect(result.current.images[0].thumbUrl).toBe('https://cdn/example-thumb.enc')
    expect(result.current.images[0].uploading).toBe(false)
    expect(result.current.hasUploading).toBe(false)
  })

  it('removes the temp image when the upload throws, and says why', async () => {
    encryptAndUploadWithThumb.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    await act(async () => {
      await result.current.addImage(makeFile())
    })

    expect(result.current.images).toEqual([])
    // A vanished thumbnail with no message is the bug, not the fix.
    expect(result.current.imageError).toMatch(/upload failed/i)
  })

  it('returns null and does nothing when given no file', async () => {
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    let ret
    await act(async () => {
      ret = await result.current.addImage(null)
    })

    expect(ret).toBe(null)
    expect(result.current.images).toEqual([])
    expect(encryptAndUploadWithThumb).not.toHaveBeenCalled()
  })

  it('removes images via removeImage', async () => {
    encryptAndUploadWithThumb.mockResolvedValue({ url: 'u', publicId: 'p', thumbUrl: '', thumbPublicId: '' })
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    let added
    await act(async () => {
      added = await result.current.addImage(makeFile())
    })

    act(() => result.current.removeImage(added.id))
    expect(result.current.images).toEqual([])
  })

  it('rejects videos that exceed maxVideoDurationSec and surfaces an error message', async () => {
    const restore = stubVideoDuration(120)
    try {
      const { result } = renderHook(() =>
        useMediaUploader({ fakeKey: true }, { maxVideoDurationSec: 60 })
      )

      await act(async () => {
        await result.current.addVideo(makeFile('clip.mp4', 'video/mp4'))
      })

      await waitFor(() => {
        expect(result.current.videoError).toMatch(/60 seconds or shorter/i)
      })
      expect(result.current.videos).toEqual([])
      expect(encryptAndUpload).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('rejects a short but oversized video before uploading, naming size and limit', async () => {
    // The reported bug: a 13-second clip is well inside the duration cap and
    // still far past Cloudinary's raw-resource cap.
    const restore = stubVideoDuration(13)
    try {
      const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

      await act(async () => {
        await result.current.addVideo(
          makeFile('clip.mp4', 'video/mp4', MAX_PLAINTEXT_BYTES + 1)
        )
      })

      await waitFor(() => {
        expect(result.current.videoError).toMatch(/10 MB/)
      })
      expect(result.current.videos).toEqual([])
      expect(encryptAndUpload).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('explains an upload failure instead of dropping the video silently', async () => {
    // Before this, the temp entry was filtered out and the only trace was a
    // dev-only console line — the spinner ended and the clip just vanished.
    const restore = stubVideoDuration(13)
    encryptAndUpload.mockRejectedValue(new Error('Upload failed (400)'))
    try {
      const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

      await act(async () => {
        await result.current.addVideo(makeFile('clip.mp4', 'video/mp4', 1024))
      })

      await waitFor(() => {
        expect(result.current.videoError).toMatch(/upload failed/i)
      })
      expect(result.current.videos).toEqual([])
    } finally {
      restore()
    }
  })

  it('reports the size limit when Cloudinary is the one that rejects the clip', async () => {
    const restore = stubVideoDuration(13)
    const tooLarge = Object.assign(new Error('File size too large'), {
      code: 'upload/too-large',
      size: 24 * 1024 * 1024,
      limit: MAX_PLAINTEXT_BYTES,
    })
    encryptAndUpload.mockRejectedValue(tooLarge)
    try {
      const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

      await act(async () => {
        await result.current.addVideo(makeFile('clip.mp4', 'video/mp4', 1024))
      })

      await waitFor(() => {
        expect(result.current.videoError).toMatch(/24 MB/)
      })
      expect(result.current.videoError).toMatch(/10 MB/)
    } finally {
      restore()
    }
  })

  it('clears a previous video error when a later pick succeeds', async () => {
    const restore = stubVideoDuration(13)
    encryptAndUpload.mockRejectedValueOnce(new Error('boom'))
    encryptAndUpload.mockResolvedValueOnce({ url: 'https://cdn/v.enc', publicId: 'v1' })
    try {
      const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

      await act(async () => {
        await result.current.addVideo(makeFile('clip.mp4', 'video/mp4', 1024))
      })
      await waitFor(() => expect(result.current.videoError).toBeTruthy())

      await act(async () => {
        await result.current.addVideo(makeFile('clip2.mp4', 'video/mp4', 1024))
      })
      await waitFor(() => expect(result.current.videoError).toBe(''))
      expect(result.current.videos).toHaveLength(1)
    } finally {
      restore()
    }
  })

  it('rejects an oversized image before uploading', async () => {
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    await act(async () => {
      await result.current.addImage(makeFile('big.jpg', 'image/jpeg', MAX_PLAINTEXT_BYTES + 1))
    })

    expect(result.current.imageError).toMatch(/10 MB/)
    expect(result.current.images).toEqual([])
    expect(encryptAndUploadWithThumb).not.toHaveBeenCalled()
  })
})
