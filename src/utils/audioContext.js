// The app's one AudioContext, which plays the best-of's music.
//
// Browsers only let audio start after a user gesture: a context created or
// resumed outside one stays suspended and plays nothing. When the best-of is
// opened from the app, the tap on the moments row's circle is that gesture, so
// the circle calls unlockAudio() in its handler and the viewer finds a running
// context. A push notification opens a fresh page with no gesture behind it,
// so there the viewer has to offer a sound button whose tap does the same.
//
// The home page imports this, so it stays small and has no imports, and
// nothing touches window before the first call: the landing page is
// pre-rendered in Node.

let context = null
let sleep = null

function cancelSleep() {
  clearTimeout(sleep)
  sleep = null
}

// Whether this device wants the music, remembered between best-ofs. A switch
// someone turned off stays off; it is the one thing here they would resent
// having to do twice. The circle asks before it unlocks, so a device with the
// music off never has a context at all.
const MUSIC_KEY = 'kaydo_bestof_music'

export function musicWantedOnDevice() {
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== 'off'
  } catch {
    return true
  }
}

export function rememberMusic(on) {
  try {
    window.localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off')
  } catch {
    // Private mode: the choice holds for this story, not the next.
  }
}

/** The shared context, or null when none has been created (or can be). */
export function getAudioContext() {
  return context
}

/**
 * Create or wake the shared context. Call it synchronously from a click,
 * pointerup or keydown handler; after an await the gesture no longer counts.
 * Returns the context, or null when the browser has no Web Audio.
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return null
  cancelSleep()
  if (!context || context.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    try {
      context = new AudioContextClass()
    } catch {
      // A browser that refuses a context (too many open, audio disabled) gets
      // a best-of without music rather than an error.
      return null
    }
  }
  if (context.state !== 'running') {
    try {
      // A refused resume() is not an error here: the context stays suspended,
      // isAudioRunning() says so, and the viewer offers its sound button.
      Promise.resolve(context.resume()).catch(() => {})
    } catch {
      // Same as above, from browsers that throw instead of rejecting.
    }
    playSilence(context)
  }
  return context
}

export function isAudioRunning() {
  return context?.state === 'running'
}

/**
 * Wake a context that was put to sleep, and call off a sleep still to come.
 * Outside a gesture this works only on a page that has had one, which a
 * context that ran before implies. Returns the context, or null.
 */
export function resumeAudio() {
  cancelSleep()
  if (context?.state === 'suspended') {
    try {
      Promise.resolve(context.resume()).catch(() => {})
    } catch {
      // Then it stays quiet until the next tap unlocks it.
    }
  }
  return context
}

/**
 * Put the context to sleep once the music has stopped, after `afterMs` for its
 * fade. A running context keeps an audio thread and the output device busy —
 * on a phone, the battery — long after the story is closed.
 */
export function suspendAudio(afterMs = 0) {
  cancelSleep()
  sleep = setTimeout(() => {
    sleep = null
    if (context?.state !== 'running') return
    try {
      Promise.resolve(context.suspend()).catch(() => {})
    } catch {
      // Then it runs on until the page closes.
    }
  }, afterMs)
}

// iOS Safari counts a context as unlocked only once a sound has actually
// started inside the gesture; resume() alone can leave it silent. One silent
// sample costs nothing elsewhere, so it plays everywhere rather than behind a
// guess at which browser this is.
function playSilence(ctx) {
  try {
    const source = ctx.createBufferSource()
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    source.connect(ctx.destination)
    source.onended = () => source.disconnect()
    source.start(0)
  } catch {
    // Nothing to unlock with; resume() above is all this browser gets.
  }
}
