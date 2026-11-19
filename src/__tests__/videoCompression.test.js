import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mediabunny drives the browser's WebCodecs encoders, which jsdom does not
// have. The fake stands in for the parts this module uses, and each test sets
// what the "file" holds and what the "encoder" produces.
const fake = vi.hoisted(() => ({
  video: { displayWidth: 1920, displayHeight: 1080 },
  audio: { averageBitrate: 128_000 },
  duration: 30,
  discarded: [],
  outputSizes: [],
  conversions: [],
}))

vi.mock('mediabunny', () => {
  class Input {
    async getPrimaryVideoTrack() { return fake.video }
    async getPrimaryAudioTrack() {
      return fake.audio && { computePacketStats: async () => ({ averageBitrate: fake.audio.averageBitrate }) }
    }
    async computeDuration() { return fake.duration }
    dispose() {}
  }
  class BufferTarget { buffer = null }
  class Output { constructor({ target }) { this.target = target } }
  class Quality { constructor(options) { this.options = options } }
  const Conversion = {
    async init(options) {
      const conversion = {
        options,
        isValid: true,
        discardedTracks: fake.discarded,
        onProgress: null,
        async execute() {
          conversion.onProgress?.(0.5)
          options.output.target.buffer = new ArrayBuffer(fake.outputSizes.shift() ?? 1000)
        },
      }
      fake.conversions.push(conversion)
      return conversion
    },
  }
  return {
    Input, BufferTarget, Output, Quality, Conversion,
    BlobSource: class {},
    Mp4OutputFormat: class {},
    ALL_FORMATS: [],
  }
})
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))

import { fitVideoToLimit, videoBitrateFor, outputDimensions } from '../utils/videoCompression'
import { MAX_PLAINTEXT_BYTES } from '../constants/media'

const LIMIT = 10 * 1024 * 1024

function bigFile(size = 40 * 1024 * 1024) {
  const file = new File([new Uint8Array([1])], 'clip.mov', { type: 'video/quicktime' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  fake.video = { displayWidth: 1920, displayHeight: 1080 }
  fake.audio = { averageBitrate: 128_000 }
  fake.duration = 30
  fake.discarded = []
  fake.outputSizes = []
  fake.conversions = []
  vi.stubGlobal('VideoEncoder', function VideoEncoder() {})
  vi.stubGlobal('VideoDecoder', function VideoDecoder() {})
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('videoBitrateFor', () => {
  it('leaves a full minute about a megabit a second once the sound is paid for', () => {
    const bitrate = videoBitrateFor(60, 128_000, LIMIT)
    expect(bitrate).toBeGreaterThan(1_000_000)
    expect(bitrate).toBeLessThan(1_100_000)
    // The whole clip, sound included, stays below the limit.
    expect(((bitrate + 128_000) * 60) / 8).toBeLessThan(LIMIT)
  })

  it('caps short clips instead of spending the whole budget', () => {
    expect(videoBitrateFor(3, 128_000, LIMIT)).toBe(4_000_000)
  })

  it('gives up when nothing watchable fits', () => {
    expect(videoBitrateFor(60, 1_200_000, LIMIT)).toBe(0)
    expect(videoBitrateFor(0, 128_000, LIMIT)).toBe(0)
    expect(videoBitrateFor(NaN, 128_000, LIMIT)).toBe(0)
  })
})

describe('outputDimensions', () => {
  it('scales the long side to 720p, landscape or portrait', () => {
    expect(outputDimensions(3840, 2160)).toEqual({ width: 1280 })
    expect(outputDimensions(1080, 1920)).toEqual({ height: 1280 })
  })

  it('never scales a small clip up', () => {
    expect(outputDimensions(640, 480)).toEqual({})
    expect(outputDimensions(1280, 720)).toEqual({})
  })
})

describe('fitVideoToLimit', () => {
  it('returns a clip that already fits untouched, without loading the encoder', async () => {
    const file = bigFile(MAX_PLAINTEXT_BYTES)
    expect(await fitVideoToLimit(file)).toBe(file)
    expect(fake.conversions).toHaveLength(0)
  })

  it('re-encodes an oversized clip to a 720p MP4 under the limit, reporting progress', async () => {
    const onProgress = vi.fn()
    const result = await fitVideoToLimit(bigFile(), { onProgress })

    expect(result.size).toBe(1000)
    expect(result.type).toBe('video/mp4')
    expect(onProgress).toHaveBeenCalledWith(0.5)
    const { video, audio } = fake.conversions[0].options
    expect(video).toMatchObject({ width: 1280, codec: 'avc' })
    expect(video.quality.options.bitrate).toBe(videoBitrateFor(30, 128_000))
    // The sound is copied, not re-encoded (see the module for why).
    expect(audio).toBeUndefined()
  })

  it('spends the whole budget on the picture when the clip has no sound', async () => {
    fake.audio = null
    await fitVideoToLimit(bigFile())
    expect(fake.conversions[0].options.video.quality.options.bitrate).toBe(videoBitrateFor(30, 0))
  })

  it('tries once more, lower, when the encoder overshoots', async () => {
    fake.outputSizes = [MAX_PLAINTEXT_BYTES + 1, 2000]
    const result = await fitVideoToLimit(bigFile())

    expect(result.size).toBe(2000)
    const [first, second] = fake.conversions.map((c) => c.options.video.quality.options.bitrate)
    expect(second).toBeLessThan(first)
  })

  it('says the clip is too large when even the second try overshoots', async () => {
    fake.outputSizes = [MAX_PLAINTEXT_BYTES + 1, MAX_PLAINTEXT_BYTES + 1]
    await expect(fitVideoToLimit(bigFile())).rejects.toMatchObject({ code: 'upload/too-large' })
  })

  it('refuses rather than upload a clip without its sound', async () => {
    fake.discarded = [{ track: { type: 'audio' }, reason: 'cannot_copy' }]
    await expect(fitVideoToLimit(bigFile())).rejects.toMatchObject({
      code: 'upload/too-large',
      size: 40 * 1024 * 1024,
      limit: MAX_PLAINTEXT_BYTES,
    })
  })

  it('says the clip is too large where the browser has no video encoder', async () => {
    vi.stubGlobal('VideoEncoder', undefined)
    await expect(fitVideoToLimit(bigFile())).rejects.toMatchObject({ code: 'upload/too-large' })
    expect(fake.conversions).toHaveLength(0)
  })

  it('says the clip is too large when it is too long for any usable bitrate', async () => {
    fake.audio = { averageBitrate: 1_500_000 }
    fake.duration = 60
    await expect(fitVideoToLimit(bigFile())).rejects.toMatchObject({ code: 'upload/too-large' })
    expect(fake.conversions).toHaveLength(0)
  })
})
