import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildTimeline,
  frameAt,
  canRecordReel,
  pickRecorderMimeType,
  recordedFileExtension,
  reelSize,
  makeHighlightDoc,
  DEFAULT_SHOT_MS,
  DEFAULT_TRANSITION_MS,
  MIN_SHOT_MS,
  MAX_SHOT_MS,
  TITLE_CARD_MS,
} from '../utils/reelRenderer'

const shots = (count, durationMs = 2000) =>
  Array.from({ length: count }, (_, i) => ({ url: `photo-${i}.jpg`, durationMs }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildTimeline', () => {
  it('overlaps consecutive shots by the transition, so the reel is shorter than the sum', () => {
    const timeline = buildTimeline(shots(3), { transitionMs: 500 })
    expect(timeline.entries.map((e) => [e.start, e.end])).toEqual([
      [0, 2000],
      [1500, 3500],
      [3000, 5000],
    ])
    // 3 × 2000 − 2 × 500
    expect(timeline.durationMs).toBe(5000)
  })

  it('leaves a single shot at its full length', () => {
    expect(buildTimeline(shots(1), { transitionMs: 600 }).durationMs).toBe(2000)
  })

  it('is empty for an empty reel', () => {
    const timeline = buildTimeline([], {})
    expect(timeline.entries).toEqual([])
    expect(timeline.durationMs).toBe(0)
  })

  it('puts the title card first when there is one', () => {
    const timeline = buildTimeline(shots(2), { transitionMs: 0, titleCard: { text: 'Our 2026' } })
    expect(timeline.entries[0].kind).toBe('title')
    expect(timeline.entries[0].durationMs).toBe(TITLE_CARD_MS)
    expect(timeline.entries[1].kind).toBe('photo')
  })

  it('ignores a title card with no text', () => {
    expect(buildTimeline(shots(1), { titleCard: { text: '' } }).entries[0].kind).toBe('photo')
  })

  it('clamps absurd shot durations into range', () => {
    const timeline = buildTimeline(
      [{ url: 'a.jpg', durationMs: 50 }, { url: 'b.jpg', durationMs: 999999 }, { url: 'c.jpg' }],
      { transitionMs: 0 }
    )
    expect(timeline.entries[0].durationMs).toBe(MIN_SHOT_MS)
    expect(timeline.entries[1].durationMs).toBe(MAX_SHOT_MS)
    expect(timeline.entries[2].durationMs).toBe(DEFAULT_SHOT_MS)
  })

  it('never overlaps more than half a shot, so a short shot cannot be swallowed', () => {
    const timeline = buildTimeline(
      [{ url: 'a.jpg', durationMs: MIN_SHOT_MS }, { url: 'b.jpg', durationMs: MIN_SHOT_MS }],
      { transitionMs: 5000 }
    )
    expect(timeline.entries[1].start).toBe(MIN_SHOT_MS / 2)
    expect(timeline.durationMs).toBe(MIN_SHOT_MS * 1.5)
  })
})

describe('frameAt', () => {
  const timeline = buildTimeline(shots(3), { transitionMs: 500 })

  it('shows one shot, fully opaque, away from the transitions', () => {
    const active = frameAt(timeline, 800)
    expect(active).toHaveLength(1)
    expect(active[0].entry.index).toBe(0)
    expect(active[0].alpha).toBe(1)
  })

  it('crossfades two shots during the overlap', () => {
    const active = frameAt(timeline, 1750) // halfway through the first transition
    expect(active).toHaveLength(2)
    const [outgoing, incoming] = active
    expect(outgoing.alpha).toBeCloseTo(0.5, 5)
    expect(incoming.alpha).toBeCloseTo(0.5, 5)
  })

  it('does not fade the very first or the very last shot', () => {
    expect(frameAt(timeline, 0)[0].alpha).toBe(1)
    expect(frameAt(timeline, timeline.durationMs - 1)[0].alpha).toBe(1)
  })

  it('reports how far into its own shot the clock is, for the Ken Burns move', () => {
    const [active] = frameAt(timeline, 1000)
    expect(active.progress).toBeCloseTo(0.5, 5)
  })

  it('shows nothing past the end', () => {
    expect(frameAt(timeline, timeline.durationMs + 1)).toEqual([])
  })
})

describe('reelSize', () => {
  it('keeps both dimensions even — odd ones break encoders', () => {
    for (const aspect of ['9:16', '1:1', '4:5']) {
      const { width, height } = reelSize(aspect, 721)
      expect(width % 2).toBe(0)
      expect(height % 2).toBe(0)
    }
  })

  it('makes a portrait reel taller than it is wide', () => {
    const { width, height } = reelSize('9:16', 720)
    expect(height).toBeGreaterThan(width)
  })
})

describe('recording support', () => {
  it('reports no recording when MediaRecorder is missing', () => {
    vi.stubGlobal('window', { MediaRecorder: undefined })
    expect(pickRecorderMimeType()).toBeNull()
    expect(canRecordReel()).toBe(false)
  })

  it('reports no recording when the canvas cannot be captured', () => {
    class FakeRecorder {}
    FakeRecorder.isTypeSupported = () => true
    vi.stubGlobal('window', { MediaRecorder: FakeRecorder })
    // jsdom's canvas has no captureStream, which is exactly the case we guard.
    expect(canRecordReel()).toBe(false)
  })

  it('picks the best codec the browser admits to', () => {
    class FakeRecorder {}
    FakeRecorder.isTypeSupported = (type) => type === 'video/webm;codecs=vp8'
    vi.stubGlobal('window', { MediaRecorder: FakeRecorder })
    expect(pickRecorderMimeType()).toBe('video/webm;codecs=vp8')
  })

  it('names the file after the container it recorded', () => {
    expect(recordedFileExtension('video/webm;codecs=vp9')).toBe('webm')
    expect(recordedFileExtension('video/mp4')).toBe('mp4')
  })
})

describe('makeHighlightDoc', () => {
  it('turns picked photos into shots of equal length', () => {
    const doc = makeHighlightDoc({
      shots: [{ url: 'a.jpg', thumbUrl: 't.jpg', memoryId: 'm1' }, { url: 'b.jpg' }],
      title: 'Summer',
    })
    expect(doc.shots).toEqual([
      { url: 'a.jpg', thumbUrl: 't.jpg', memoryId: 'm1', durationMs: DEFAULT_SHOT_MS },
      { url: 'b.jpg', thumbUrl: null, memoryId: null, durationMs: DEFAULT_SHOT_MS },
    ])
    expect(doc.titleCard.text).toBe('Summer')
    expect(doc.transitionMs).toBe(DEFAULT_TRANSITION_MS)
    expect(doc.aspect).toBe('9:16')
  })
})
