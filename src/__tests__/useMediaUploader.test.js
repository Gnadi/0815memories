import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// encryptAndUpload is the only side-effect we care about; mocking it at
// module-load time keeps the hook isolated from Cloudinary + Web Crypto.
vi.mock('../utils/encryptedUpload', () => ({
  encryptAndUpload: vi.fn(),
}))
vi.mock('../utils/devLog', () => ({
  devError: vi.fn(),
  devWarn: vi.fn(),
}))

import { encryptAndUpload } from '../utils/encryptedUpload'
import { useMediaUploader } from '../hooks/useMediaUploader'

// jsdom's URL.createObjectURL is absent by default.
beforeEach(() => {
  encryptAndUpload.mockReset()
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
  }
})

function makeFile(name = 'pic.jpg', type = 'image/jpeg') {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

describe('useMediaUploader', () => {
  it('adds an image with a temp entry, then swaps in the uploaded URL', async () => {
    encryptAndUpload.mockResolvedValue({ url: 'https://cdn/example.enc', publicId: 'pub123' })
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    await act(async () => {
      await result.current.addImage(makeFile())
    })

    expect(result.current.images).toHaveLength(1)
    expect(result.current.images[0].url).toBe('https://cdn/example.enc')
    expect(result.current.images[0].publicId).toBe('pub123')
    expect(result.current.images[0].uploading).toBe(false)
    expect(result.current.hasUploading).toBe(false)
  })

  it('removes the temp image when the upload throws', async () => {
    encryptAndUpload.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    await act(async () => {
      await result.current.addImage(makeFile())
    })

    expect(result.current.images).toEqual([])
  })

  it('returns null and does nothing when given no file', async () => {
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    let ret
    await act(async () => {
      ret = await result.current.addImage(null)
    })

    expect(ret).toBe(null)
    expect(result.current.images).toEqual([])
    expect(encryptAndUpload).not.toHaveBeenCalled()
  })

  it('removes images via removeImage', async () => {
    encryptAndUpload.mockResolvedValue({ url: 'u', publicId: 'p' })
    const { result } = renderHook(() => useMediaUploader({ fakeKey: true }))

    let added
    await act(async () => {
      added = await result.current.addImage(makeFile())
    })

    act(() => result.current.removeImage(added.id))
    expect(result.current.images).toEqual([])
  })

  it('rejects videos that exceed maxVideoDurationSec and surfaces an error message', async () => {
    // getVideoDuration spawns a hidden <video> element and reads .duration
    // once `loadedmetadata` fires. In jsdom neither fires naturally, so we
    // override the prototype's `duration` getter and the `src` setter to
    // synchronously invoke the metadata callback with an over-long value.
    const originalDuration = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')
    const originalSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
      configurable: true,
      get() { return 120 },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      set() { queueMicrotask(() => this.onloadedmetadata?.()) },
    })

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
      if (originalDuration) Object.defineProperty(HTMLMediaElement.prototype, 'duration', originalDuration)
      if (originalSrc) Object.defineProperty(HTMLMediaElement.prototype, 'src', originalSrc)
    }
  })
})
