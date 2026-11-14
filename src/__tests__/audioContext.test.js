/* The app's one AudioContext (utils/audioContext.js): made in a gesture, put to
   sleep once the music has stopped, and woken when it plays again. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

class FakeContext {
  state = 'suspended'
  sampleRate = 48000
  destination = {}
  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
  suspend = vi.fn(() => {
    this.state = 'suspended'
    return Promise.resolve()
  })
  createBufferSource = () => ({ connect() {}, disconnect() {}, start() {} })
  createBuffer = () => ({})
}

// A fresh module for each test: the context lives in it.
let audio
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeContext)
  localStorage.clear()
  vi.resetModules()
  audio = await import('../utils/audioContext')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('audioContext', () => {
  it('makes no context until a gesture unlocks one, and then runs it', () => {
    expect(audio.getAudioContext()).toBeNull()
    const context = audio.unlockAudio()
    expect(context).toBeInstanceOf(FakeContext)
    expect(context.state).toBe('running')
    expect(audio.unlockAudio()).toBe(context)
  })

  it('puts the context to sleep once the fade is over', () => {
    const context = audio.unlockAudio()
    audio.suspendAudio(400)
    vi.advanceTimersByTime(399)
    expect(context.suspend).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(context.state).toBe('suspended')

    expect(audio.resumeAudio()).toBe(context)
    expect(context.state).toBe('running')
  })

  it('stays awake when the music plays again before the sleep', () => {
    const context = audio.unlockAudio()
    audio.suspendAudio(400)
    audio.resumeAudio()
    audio.suspendAudio(400)
    audio.unlockAudio()
    vi.advanceTimersByTime(1000)
    expect(context.suspend).not.toHaveBeenCalled()
    expect(context.state).toBe('running')
  })

  it('remembers on the device whether the music is wanted', () => {
    expect(audio.musicWantedOnDevice()).toBe(true)
    audio.rememberMusic(false)
    expect(audio.musicWantedOnDevice()).toBe(false)
    audio.rememberMusic(true)
    expect(audio.musicWantedOnDevice()).toBe(true)
  })
})
