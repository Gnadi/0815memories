import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TRACKS, arrangement, barMs, createSoundtrack, trackForMonth } from '../utils/bestOfMusic'

// jsdom has no Web Audio, so this stands in for it. It is strict where
// browsers are strict (a non-finite value, a negative time, an exponential
// ramp to zero, a zero time constant, a source started twice all throw
// there), so a voice that would fail in a browser fails here too.

function check(...values) {
  for (const value of values) {
    if (!Number.isFinite(value)) throw new TypeError(`not a finite number: ${value}`)
  }
}

class FakeParam {
  constructor(value) {
    this.value = value
    this.events = []
  }
  add(kind, value, time, extra) {
    check(value, time)
    if (time < 0) throw new RangeError(`negative time: ${time}`)
    this.events.push({ kind, value, time, extra })
    return this
  }
  setValueAtTime(value, time) {
    return this.add('set', value, time)
  }
  linearRampToValueAtTime(value, time) {
    return this.add('linear', value, time)
  }
  exponentialRampToValueAtTime(value, time) {
    if (value <= 0) throw new RangeError('an exponential ramp cannot reach zero')
    return this.add('exponential', value, time)
  }
  setTargetAtTime(value, time, constant) {
    check(constant)
    if (constant <= 0) throw new RangeError('the time constant must be positive')
    return this.add('target', value, time, constant)
  }
  cancelScheduledValues(time) {
    check(time)
    this.events = this.events.filter((event) => event.time < time)
    return this
  }
  get last() {
    return this.events[this.events.length - 1]
  }
}

class FakeNode {
  constructor(context, kind, params = {}) {
    this.context = context
    this.kind = kind
    this.outputs = []
    for (const [name, value] of Object.entries(params)) this[name] = new FakeParam(value)
    context.nodes.push(this)
  }
  connect(target) {
    if (!target) throw new TypeError('nothing to connect to')
    this.outputs.push(target)
    return target
  }
  disconnect() {
    this.outputs = []
  }
}

class FakeSource extends FakeNode {
  start(time = 0, offset = 0) {
    check(time, offset)
    if (this.startedAt !== undefined) throw new Error('InvalidStateError: started twice')
    this.startedAt = time
    this.offset = offset
  }
  stop(time = 0) {
    check(time)
    if (this.startedAt === undefined) throw new Error('InvalidStateError: stopped before it started')
    this.stoppedAt = time
  }
  setPeriodicWave(wave) {
    this.type = 'custom'
    this.wave = wave
  }
}

class FakeAudioContext {
  constructor() {
    this.nodes = []
    this.buffers = 0
    this.currentTime = 0
    this.sampleRate = 8000
    this.state = 'running'
    this.destination = new FakeNode(this, 'destination')
    this.suspend = vi.fn(() => {
      this.state = 'suspended'
      return Promise.resolve()
    })
    this.resume = vi.fn(() => {
      this.state = 'running'
      return Promise.resolve()
    })
  }
  createOscillator() {
    const node = new FakeSource(this, 'oscillator', { frequency: 440, detune: 0 })
    node.type = 'sine'
    return node
  }
  createBufferSource() {
    const node = new FakeSource(this, 'bufferSource', { playbackRate: 1 })
    node.buffer = null
    return node
  }
  createGain() {
    return new FakeNode(this, 'gain', { gain: 1 })
  }
  createBiquadFilter() {
    const node = new FakeNode(this, 'filter', { frequency: 350, Q: 1, gain: 0, detune: 0 })
    node.type = 'lowpass'
    return node
  }
  createConvolver() {
    const node = new FakeNode(this, 'convolver')
    node.buffer = null
    return node
  }
  createDynamicsCompressor() {
    return new FakeNode(this, 'compressor', { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 })
  }
  createBuffer(channels, length, sampleRate) {
    check(channels, length, sampleRate)
    this.buffers += 1
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (channel) => data[channel] }
  }
  createPeriodicWave(real, imag) {
    return { real, imag }
  }
  // The audio thread's clock, which stands still while the context is suspended.
  tick(seconds) {
    if (this.state === 'running') this.currentTime += seconds
  }
}

// Real time passing: the audio clock and the timers together, in steps the
// size of the scheduler's.
function elapse(context, seconds) {
  for (let step = 0; step < Math.round(seconds / 0.025); step++) {
    context.tick(0.025)
    vi.advanceTimersByTime(25)
  }
}

// A note's sources are told when to stop; the pad's slow filter drift is not.
const notes = (context) => context.nodes.filter((node) => node.stoppedAt !== undefined)
const master = (context) => context.nodes.find((node) => node.outputs.includes(context.destination))
const connected = (context) => context.nodes.filter((node) => node.outputs.length)
const loopSeconds = (trackId) => (TRACKS[trackId].bars * barMs(trackId)) / 1000

const PITCHED = new Set(['pad', 'keys', 'pluck', 'bass'])
const DRUMS = new Set(['kick', 'shaker', 'clap'])
// Pitch classes, C = 0, written out independently of the tracks.
const SCALES = {
  warm: [2, 4, 6, 7, 9, 11, 1], // D major
  bright: [7, 9, 11, 0, 2, 4, 6], // G major
  calm: [5, 7, 9, 10, 0, 2, 4], // F major
}

describe('arrangement', () => {
  it('is the same every time it is asked for', () => {
    for (const id of Object.keys(TRACKS)) {
      const first = arrangement(id)
      const second = arrangement(id)
      expect(second).toEqual(first)
      expect(second).not.toBe(first)
    }
    expect(arrangement('nonsense')).toEqual(arrangement('warm'))
  })

  it('is one loop of the track, in order', () => {
    for (const id of Object.keys(TRACKS)) {
      const { bpm, bars, events } = arrangement(id)
      expect(bpm).toBe(TRACKS[id].bpm)
      expect(bars).toBe(TRACKS[id].bars)
      expect(events.length).toBeGreaterThan(0)
      for (const [index, event] of events.entries()) {
        expect(event.beat).toBeGreaterThanOrEqual(0)
        expect(event.beat).toBeLessThan(bars * 4)
        if (index) expect(event.beat).toBeGreaterThanOrEqual(events[index - 1].beat)
        expect(event.length).toBeGreaterThan(0)
        expect(event.velocity).toBeGreaterThan(0)
        expect(event.velocity).toBeLessThanOrEqual(1)
        expect(PITCHED.has(event.voice) || DRUMS.has(event.voice)).toBe(true)
      }
      // Something sounding on every downbeat, so the loop has no hole to fall
      // into — a note struck there, or one held through it, as the calm
      // track's pad is.
      for (let bar = 0; bar < bars; bar++) {
        const downbeat = bar * 4
        expect(events.some((event) => event.beat <= downbeat && downbeat < event.beat + event.length)).toBe(true)
      }
    }
  })

  it('stays in key', () => {
    for (const [id, scale] of Object.entries(SCALES)) {
      for (const event of arrangement(id).events) {
        if (DRUMS.has(event.voice)) {
          expect(event.midi).toBeNull()
        } else {
          expect(Number.isInteger(event.midi)).toBe(true)
          expect(scale).toContain(event.midi % 12)
        }
      }
    }
  })

  it('keeps the drums where they belong, and out of the calm track', () => {
    const drums = (id, voice) => arrangement(id).events.filter((event) => event.voice === voice)
    expect(arrangement('calm').events.filter((event) => DRUMS.has(event.voice))).toEqual([])
    expect(drums('warm', 'kick').every((event) => event.beat % 4 === 0 || event.beat % 4 === 2)).toBe(true)
    expect(drums('bright', 'clap').every((event) => event.beat % 4 === 1 || event.beat % 4 === 3)).toBe(true)
    expect(drums('warm', 'shaker').length).toBeGreaterThan(0)
  })
})

describe('trackForMonth', () => {
  it('is calm in winter, bright in summer and warm in between', () => {
    expect(['2026-12', '2027-01', '2026-02'].map(trackForMonth)).toEqual(['calm', 'calm', 'calm'])
    expect(['2026-06', '2026-07', '2026-08'].map(trackForMonth)).toEqual(['bright', 'bright', 'bright'])
    expect(['2026-03', '2026-05', '2026-09', '2026-11'].map(trackForMonth)).toEqual(['warm', 'warm', 'warm', 'warm'])
  })

  it('is warm for anything that is not a month', () => {
    for (const value of ['2026-13', '2026-1', 'december', '', null, undefined, 202612, {}]) {
      expect(trackForMonth(value)).toBe('warm')
    }
  })
})

describe('barMs', () => {
  it('is four beats at the track’s tempo', () => {
    for (const [id, track] of Object.entries(TRACKS)) {
      expect(barMs(id)).toBeCloseTo((4 * 60000) / track.bpm, 6)
    }
    expect(barMs('nonsense')).toBe(barMs('warm'))
  })
})

describe('createSoundtrack', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules only what falls within the lookahead, and keeps scheduling', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.start()
    expect(soundtrack.isPlaying()).toBe(true)

    const first = notes(context)
    expect(first.length).toBeGreaterThan(0)
    expect(Math.max(...first.map((node) => node.startedAt))).toBeLessThanOrEqual(0.25)

    elapse(context, 3)
    const later = notes(context)
    expect(later.length).toBeGreaterThan(first.length)
    expect(Math.max(...later.map((node) => node.startedAt))).toBeLessThanOrEqual(context.currentTime + 0.25)
    // Fading in, toward a level well short of full scale.
    expect(master(context).gain.last).toMatchObject({ kind: 'linear', value: 0.75 })
  })

  it('goes round the loop again when it ends', () => {
    const context = new FakeAudioContext()
    createSoundtrack(context, 'warm').start()
    elapse(context, loopSeconds('warm') + 1)

    const starts = notes(context).map((node) => node.startedAt)
    const origin = Math.min(...starts)
    const at = (time) => starts.filter((start) => Math.abs(start - time) < 1e-6).length
    expect(at(origin)).toBeGreaterThan(0)
    expect(at(origin + loopSeconds('warm'))).toBe(at(origin))
  })

  it('plays every track for a whole loop without a browser objecting', () => {
    for (const id of Object.keys(TRACKS)) {
      const context = new FakeAudioContext()
      const soundtrack = createSoundtrack(context, id)
      expect(() => {
        soundtrack.start()
        elapse(context, loopSeconds(id) + 1)
        soundtrack.stop({ fadeMs: 0 })
      }).not.toThrow()
    }
  })

  it('does not schedule twice when started twice', () => {
    const once = new FakeAudioContext()
    const twice = new FakeAudioContext()
    createSoundtrack(once, 'bright').start()
    const soundtrack = createSoundtrack(twice, 'bright')
    soundtrack.start()
    soundtrack.start()
    elapse(once, 3)
    elapse(twice, 3)
    expect(twice.nodes.length).toBe(once.nodes.length)
  })

  it('lets go of every note once it has ended', () => {
    const context = new FakeAudioContext()
    createSoundtrack(context, 'bright').start()
    const endAll = () => {
      for (const node of context.nodes) node.onended?.()
    }

    elapse(context, 3)
    for (const node of notes(context)) expect(node.stoppedAt).toBeGreaterThan(node.startedAt)
    endAll()
    const settled = connected(context).length
    expect(notes(context).filter((node) => node.outputs.length)).toEqual([])

    elapse(context, 10)
    endAll()
    expect(connected(context).length).toBe(settled)
  })

  it('makes its noise and its reverb once, not once per hit', () => {
    const context = new FakeAudioContext()
    createSoundtrack(context, 'bright').start()
    elapse(context, 5)
    createSoundtrack(context, 'warm').start()
    elapse(context, 5)
    expect(notes(context).filter((node) => node.kind === 'bufferSource').length).toBeGreaterThan(10)
    expect(context.buffers).toBe(2)
  })

  it('fades out and suspends the context on pause, and carries on on resume', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.start()
    elapse(context, 2)

    soundtrack.pause()
    expect(soundtrack.isPlaying()).toBe(false)
    expect(master(context).gain.last).toMatchObject({ kind: 'linear', value: 0 })
    elapse(context, 0.1)
    expect(context.suspend).toHaveBeenCalledTimes(1)
    expect(context.state).toBe('suspended')

    const paused = context.nodes.length
    elapse(context, 5)
    expect(context.nodes.length).toBe(paused)

    soundtrack.resume()
    expect(soundtrack.isPlaying()).toBe(true)
    expect(context.resume).toHaveBeenCalledTimes(1)
    expect(master(context).gain.last).toMatchObject({ kind: 'linear', value: 0.75 })
    elapse(context, 2)
    expect(context.nodes.length).toBeGreaterThan(paused)
  })

  it('does not suspend when resumed before the pause has faded', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.start()
    elapse(context, 1)
    soundtrack.pause()
    elapse(context, 0.025)
    soundtrack.resume()
    elapse(context, 1)
    expect(context.suspend).not.toHaveBeenCalled()
    expect(soundtrack.isPlaying()).toBe(true)
  })

  it('ignores pause and resume when it is not playing', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.pause()
    soundtrack.resume()
    soundtrack.start()
    soundtrack.stop({ fadeMs: 0 })
    soundtrack.pause()
    soundtrack.resume()
    vi.advanceTimersByTime(1000)
    expect(context.suspend).not.toHaveBeenCalled()
    expect(context.resume).not.toHaveBeenCalled()
  })

  it('fades out on stop, then stops scheduling and disconnects', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.start()
    elapse(context, 2)

    soundtrack.stop()
    expect(soundtrack.isPlaying()).toBe(false)
    expect(master(context).gain.last).toMatchObject({ kind: 'linear', value: 0 })
    expect(master(context).gain.last.time).toBeCloseTo(context.currentTime + 0.6, 6)
    const out = master(context)
    elapse(context, 0.7)

    expect(vi.getTimerCount()).toBe(0)
    expect(out.outputs).toEqual([])
    const stopped = context.nodes.length
    elapse(context, 5)
    expect(context.nodes.length).toBe(stopped)

    expect(() => soundtrack.stop()).not.toThrow()
    soundtrack.start()
    elapse(context, 1)
    expect(context.nodes.length).toBe(stopped)
  })

  it('stops at once with no fade', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'calm')
    soundtrack.start()
    elapse(context, 1)
    soundtrack.stop({ fadeMs: 0 })
    expect(vi.getTimerCount()).toBe(0)
    expect(connected(context)).toEqual([])
  })

  it('stops while paused', () => {
    const context = new FakeAudioContext()
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.start()
    elapse(context, 1)
    soundtrack.pause()
    elapse(context, 0.2)
    soundtrack.stop()
    vi.advanceTimersByTime(1000)
    expect(vi.getTimerCount()).toBe(0)
    expect(connected(context)).toEqual([])
  })

  it('starts on a suspended context, to play once it runs', () => {
    const context = new FakeAudioContext()
    context.state = 'suspended'
    const soundtrack = createSoundtrack(context, 'warm')
    soundtrack.start()
    const waiting = notes(context).length
    expect(waiting).toBeGreaterThan(0)
    elapse(context, 2)
    expect(notes(context).length).toBe(waiting)

    context.resume()
    elapse(context, 2)
    expect(notes(context).length).toBeGreaterThan(waiting)
  })

  it('does nothing without a context', () => {
    for (const context of [null, undefined]) {
      const soundtrack = createSoundtrack(context, 'warm')
      expect(() => {
        soundtrack.start()
        soundtrack.pause()
        soundtrack.resume()
        soundtrack.stop()
        soundtrack.stop({ fadeMs: 0 })
      }).not.toThrow()
      expect(soundtrack.isPlaying()).toBe(false)
    }
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('unlockAudio', () => {
  let saved

  beforeEach(() => {
    // The module keeps its context, so every test imports a fresh copy.
    vi.resetModules()
    saved = { AudioContext: window.AudioContext, webkitAudioContext: window.webkitAudioContext }
    delete window.AudioContext
    delete window.webkitAudioContext
  })

  afterEach(() => {
    // First, so that a test that took the window away has it back.
    vi.unstubAllGlobals()
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete window[name]
      else window[name] = value
    }
  })

  const audioContextModule = () => import('../utils/audioContext')

  function stub(name, setUp = () => {}) {
    const created = []
    window[name] = class extends FakeAudioContext {
      constructor() {
        super()
        this.state = 'suspended'
        setUp(this)
        created.push(this)
      }
    }
    return created
  }

  it('creates one context, wakes it and keeps it', async () => {
    const created = stub('AudioContext')
    const { getAudioContext, isAudioRunning, unlockAudio } = await audioContextModule()
    expect(getAudioContext()).toBeNull()
    expect(isAudioRunning()).toBe(false)

    const context = unlockAudio()
    expect(created).toEqual([context])
    expect(context.resume).toHaveBeenCalledTimes(1)
    // The silent sample that unlocks iOS.
    expect(context.nodes.some((node) => node.kind === 'bufferSource' && node.startedAt === 0)).toBe(true)
    expect(getAudioContext()).toBe(context)
    expect(isAudioRunning()).toBe(true)

    expect(unlockAudio()).toBe(context)
    expect(created).toHaveLength(1)
  })

  it('wakes the context again once it has been suspended', async () => {
    stub('AudioContext')
    const { unlockAudio } = await audioContextModule()
    const context = unlockAudio()
    context.state = 'suspended'
    expect(unlockAudio()).toBe(context)
    expect(context.resume).toHaveBeenCalledTimes(2)
  })

  it('uses the prefixed constructor of older Safari', async () => {
    const created = stub('webkitAudioContext')
    const { unlockAudio } = await audioContextModule()
    expect(unlockAudio()).toBe(created[0])
  })

  it('does not complain when the browser refuses to resume', async () => {
    stub('AudioContext', (context) => {
      context.resume = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    })
    const { isAudioRunning, unlockAudio } = await audioContextModule()
    expect(unlockAudio()).not.toBeNull()
    await Promise.resolve()
    expect(isAudioRunning()).toBe(false)
  })

  it('returns null without Web Audio', async () => {
    const { getAudioContext, isAudioRunning, unlockAudio } = await audioContextModule()
    expect(unlockAudio()).toBeNull()
    expect(getAudioContext()).toBeNull()
    expect(isAudioRunning()).toBe(false)
  })

  it('returns null where there is no window, as in the pre-render', async () => {
    stub('AudioContext')
    const { unlockAudio } = await audioContextModule()
    vi.stubGlobal('window', undefined)
    expect(unlockAudio()).toBeNull()
  })
})
