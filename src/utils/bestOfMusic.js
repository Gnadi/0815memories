// The best-of's soundtrack: background music made in the browser with the Web
// Audio API, from a few oscillators and a little noise. There are no audio
// files and no network: like the rest of the best-of, it never leaves the
// device.
//
// Eight tracks, each with its own progression, key, tempo and instruments,
// taken in turn from month to month (see trackForMonth), so that one month's
// best-of does not sound like the last one's, and everyone in the family hears
// the same music under the same best-of. Each is an eight-bar loop of a
// four-chord progression, one chord every two bars, that goes round for as
// long as the story plays.
//
// The musical design follows from where it plays: under photos, mostly from a
// phone speaker, to people who are looking rather than listening. So the
// tempos are unhurried, the progressions are ones everybody has heard a
// thousand times, nothing starts with a hard edge, and every voice with upper
// harmonics goes through a lowpass, so it never gets harsh. The bass sits high
// enough for a phone to play its overtones, the drums are felt more than
// heard, the reverb is short and dark, and a gentle compressor keeps a pile-up
// of notes from getting loud. The whole mix peaks well below full scale.
import { parseMonthKey } from './bestOf'

const BEATS_PER_BAR = 4
const DRUMS = new Set(['kick', 'shaker', 'clap'])

// Steps of a pattern, one chord (two bars) long, by voice:
//   pad                    [beat, length, velocity], for every note of chord.pad
//   keys, pluck, string,
//   bell, pizz, arp        [beat, tone, length, velocity, octave?], tone indexes
//                          chord.tones, octave moves it by twelve
//   bass                   [beat, octave, length, velocity], on chord.bass
//   kick, shaker, clap     [beat, velocity]
// Lengths are in beats; a note may ring past the end of its chord, or of the
// loop, into the next one. A bar has four beats unless the track says
// otherwise (`meter`), as the waltz does.
const twice = (bar) => [...bar, ...bar.map(([beat, ...rest]) => [beat + BEATS_PER_BAR, ...rest])]

// Voicings are written out as MIDI notes (60 is middle C) rather than derived,
// so what plays is what is read here. The pad moves by step from chord to
// chord, the way a pianist's hand would.
export const TRACKS = {
  // Spring and autumn: I–V–vi–IV in D major. Electric-piano arpeggios over a
  // pad, a round bass and the softest kick and shaker.
  warm: {
    bpm: 92,
    bars: 8,
    key: 'D major',
    padAttack: 0.5,
    chords: [
      { name: 'D', bass: 38, pad: [57, 62, 66], tones: [62, 66, 69, 74] },
      { name: 'A', bass: 45, pad: [57, 61, 64], tones: [61, 64, 69, 73] },
      { name: 'Bm', bass: 47, pad: [59, 62, 66], tones: [62, 66, 71, 74] },
      { name: 'G', bass: 43, pad: [59, 62, 67], tones: [62, 67, 71, 74] },
    ],
    parts: {
      pad: [[0, 8, 0.55]],
      keys: [
        [0, 0, 1.5, 0.6], [0.5, 2, 1.25, 0.4], [1, 1, 1.25, 0.5], [1.5, 3, 1.25, 0.4],
        [2, 2, 1.25, 0.52], [2.5, 1, 1.25, 0.38], [3, 2, 1.25, 0.48], [3.5, 3, 1.25, 0.36],
        [4, 0, 1.5, 0.55], [4.5, 2, 1.25, 0.4], [5, 1, 1.25, 0.48], [5.5, 3, 1.25, 0.4],
        [6, 2, 1.5, 0.5], [6.5, 3, 1.25, 0.36], [7.5, 1, 1, 0.34],
      ],
      bass: [
        [0, 0, 1.5, 0.8], [1.5, 0, 0.5, 0.45], [2, 0, 2, 0.65],
        [4, 0, 1.5, 0.75], [5.5, 0, 0.5, 0.45], [6, 0, 1.25, 0.6], [7.5, 1, 0.5, 0.4],
      ],
      kick: twice([[0, 0.5], [2, 0.38]]),
      shaker: twice([[0.5, 0.35], [1.5, 0.25], [2.5, 0.35], [3.5, 0.28]]),
    },
  },
  // Summer: I–V–vi–IV in G major, a little quicker. A marimba-like motif in a
  // 3-3-2 rhythm over the chords, a bass pulsing in eighths and a soft clap
  // on two and four.
  bright: {
    bpm: 110,
    bars: 8,
    key: 'G major',
    padAttack: 0.5,
    chords: [
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [62, 67, 71, 74, 79] },
      { name: 'D', bass: 38, pad: [54, 57, 62], tones: [62, 66, 69, 74, 78] },
      { name: 'Em', bass: 40, pad: [55, 59, 64], tones: [64, 67, 71, 76, 79] },
      { name: 'C', bass: 36, pad: [55, 60, 64], tones: [64, 67, 72, 76, 79] },
    ],
    parts: {
      pad: [[0, 8, 0.4]],
      pluck: [
        [0, 1, 0.5, 0.7], [0.75, 2, 0.5, 0.5], [1.5, 3, 0.5, 0.55], [2, 2, 0.5, 0.6],
        [2.5, 4, 0.5, 0.5], [3, 3, 0.5, 0.55], [3.5, 2, 0.5, 0.45],
        [4, 1, 0.5, 0.65], [4.75, 2, 0.5, 0.5], [5.5, 3, 0.5, 0.55], [6, 4, 0.5, 0.6],
        [6.5, 3, 0.5, 0.45], [7, 2, 1, 0.5],
      ],
      // Softer than the warm track's: in eighths, a bass at full weight would
      // be all a phone hears of the bar.
      bass: twice([
        [0, 0, 0.9, 0.55], [1, 0, 0.45, 0.38], [1.5, 0, 0.45, 0.34],
        [2, 0, 0.9, 0.48], [3, 0, 0.45, 0.38], [3.5, 1, 0.45, 0.32],
      ]),
      kick: twice([[0, 0.4], [2, 0.32]]),
      clap: twice([[1, 0.45], [3, 0.5]]),
      shaker: twice([[0.5, 0.35], [1.5, 0.28], [2.5, 0.35], [3.5, 0.28], [3.75, 0.18]]),
    },
  },
  // Winter: Fmaj7–C–Dm7–B♭maj7 in F major, slow. Long pads, a held bass and a
  // few piano notes per chord, with room between them. No drums.
  calm: {
    bpm: 76,
    bars: 8,
    key: 'F major',
    padAttack: 1.2,
    chords: [
      { name: 'Fmaj7', bass: 41, pad: [53, 57, 60, 64], tones: [69, 72, 76, 74] },
      { name: 'C', bass: 36, pad: [52, 55, 60, 64], tones: [67, 72, 76, 74] },
      { name: 'Dm7', bass: 38, pad: [53, 57, 60, 62], tones: [69, 72, 77, 76] },
      { name: 'B♭maj7', bass: 34, pad: [53, 57, 58, 62], tones: [65, 69, 74, 72] },
    ],
    parts: {
      pad: [[0, 8, 0.6]],
      keys: [[0, 0, 3, 0.5], [1.5, 1, 2.5, 0.38], [3, 2, 3, 0.45], [6, 3, 2, 0.35]],
      bass: [[0, 0, 7.5, 0.5]],
    },
  },
  // C–Am–F–G in C major. A guitar picked in eighths, the thumb on the low
  // strings and the fingers above, over a quiet pad, a shaker and a kick that
  // is barely there.
  folk: {
    bpm: 96,
    bars: 8,
    key: 'C major',
    padAttack: 0.8,
    chords: [
      { name: 'C', bass: 36, pad: [55, 60, 64], tones: [48, 55, 60, 64, 67] },
      { name: 'Am', bass: 45, pad: [57, 60, 64], tones: [45, 52, 57, 60, 64] },
      { name: 'F', bass: 41, pad: [57, 60, 65], tones: [41, 48, 53, 57, 60] },
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [43, 50, 55, 59, 62] },
    ],
    parts: {
      pad: [[0, 8, 0.28]],
      string: twice([
        [0, 0, 1.5, 0.7], [0.5, 3, 1, 0.45], [1, 1, 1.5, 0.55], [1.5, 4, 1, 0.45],
        [2, 0, 1.5, 0.6], [2.5, 3, 1, 0.42], [3, 1, 1.5, 0.52], [3.5, 2, 1, 0.4],
      ]),
      kick: twice([[0, 0.3]]),
      shaker: twice([[0.5, 0.25], [1.5, 0.3], [2.5, 0.25], [3.5, 0.3]]),
    },
  },
  // E♭maj7–Dm7–Cm7–F7 in B♭ major, slow and swung: rolled electric-piano
  // chords with a few lazy notes between them, a walking bass and a soft,
  // late beat — the sound of a rainy afternoon.
  lofi: {
    bpm: 78,
    bars: 8,
    key: 'B♭ major',
    padAttack: 1,
    chords: [
      { name: 'E♭maj7', bass: 39, pad: [55, 58, 62], tones: [63, 67, 70, 74] },
      { name: 'Dm7', bass: 38, pad: [53, 57, 60], tones: [62, 65, 69, 72] },
      { name: 'Cm7', bass: 36, pad: [51, 55, 58], tones: [60, 63, 67, 70] },
      { name: 'F7', bass: 41, pad: [51, 57, 60], tones: [60, 63, 65, 69] },
    ],
    parts: {
      pad: [[0, 8, 0.3]],
      keys: [
        [0, 0, 2, 0.42], [0.03, 1, 2, 0.36], [0.06, 2, 2, 0.36],
        [1.67, 3, 0.8, 0.38], [2.67, 2, 0.8, 0.32], [3, 1, 1, 0.34],
        [4, 0, 2, 0.38], [4.03, 1, 2, 0.32], [4.06, 3, 2, 0.34],
        [5.67, 2, 0.6, 0.3], [6, 1, 1.2, 0.34], [7.33, 3, 0.6, 0.28],
      ],
      bass: [
        [0, 0, 1.5, 0.6], [1.67, 0, 0.3, 0.35], [2, 1, 0.4, 0.3], [2.67, 0, 1, 0.45],
        [4, 0, 1.5, 0.55], [6, 0, 0.5, 0.4], [6.67, 1, 0.3, 0.3], [7.33, 0, 0.5, 0.35],
      ],
      kick: twice([[0, 0.45], [2.67, 0.3]]),
      clap: twice([[1, 0.3], [3, 0.34]]),
      shaker: twice([[0.67, 0.18], [1.67, 0.2], [2.67, 0.18], [3.67, 0.22]]),
    },
  },
  // A–F♯m–D–E in A major, in three: a music box over a bass on the one and
  // pizzicato strings on two and three. No drums.
  waltz: {
    bpm: 126,
    bars: 8,
    meter: 3,
    key: 'A major',
    padAttack: 0.8,
    chords: [
      { name: 'A', bass: 45, pad: [57, 61, 64], tones: [69, 73, 76, 81] },
      { name: 'F♯m', bass: 42, pad: [57, 61, 66], tones: [66, 69, 73, 78] },
      { name: 'D', bass: 50, pad: [57, 62, 66], tones: [66, 69, 74, 78] },
      { name: 'E', bass: 52, pad: [56, 59, 64], tones: [68, 71, 76, 80] },
    ],
    parts: {
      pad: [[0, 6, 0.25]],
      bass: [[0, 0, 1, 0.6], [3, 0, 1, 0.55]],
      pizz: [
        [1, 0, 0.4, 0.4, -1], [1, 1, 0.4, 0.34, -1], [2, 0, 0.4, 0.36, -1], [2, 1, 0.4, 0.3, -1],
        [4, 0, 0.4, 0.38, -1], [4, 1, 0.4, 0.32, -1], [5, 0, 0.4, 0.34, -1], [5, 1, 0.4, 0.3, -1],
      ],
      bell: [
        [0, 2, 1.5, 0.5], [1.5, 1, 0.5, 0.35], [2, 3, 1, 0.45],
        [3, 2, 1, 0.42], [4, 1, 1, 0.38], [5, 0, 1, 0.4],
      ],
    },
  },
  // Am–F–C–G in C major, the quickest of them: a synth arpeggio in
  // sixteenths, an octave bass in eighths, a kick on every beat and a clap on
  // two and four, all of it softened.
  pop: {
    bpm: 116,
    bars: 8,
    key: 'C major',
    padAttack: 0.5,
    chords: [
      { name: 'Am', bass: 45, pad: [57, 60, 64], tones: [57, 60, 64, 69] },
      { name: 'F', bass: 41, pad: [57, 60, 65], tones: [53, 57, 60, 65] },
      { name: 'C', bass: 48, pad: [55, 60, 64], tones: [55, 60, 64, 67] },
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [55, 59, 62, 67] },
    ],
    parts: {
      pad: [[0, 8, 0.32]],
      arp: twice([0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 2, 3, 1, 2].map((tone, i) => [i / 4, tone, 0.22, i % 4 === 0 ? 0.55 : 0.34])),
      bass: twice([
        [0, 0, 0.45, 0.5], [0.5, 1, 0.4, 0.32], [1, 0, 0.45, 0.42], [1.5, 1, 0.4, 0.3],
        [2, 0, 0.45, 0.46], [2.5, 1, 0.4, 0.32], [3, 0, 0.45, 0.42], [3.5, 1, 0.4, 0.3],
      ]),
      kick: twice([[0, 0.42], [1, 0.34], [2, 0.4], [3, 0.34]]),
      clap: twice([[1, 0.4], [3, 0.45]]),
      shaker: twice([[0.5, 0.28], [1.5, 0.24], [2.5, 0.28], [3.5, 0.24]]),
    },
  },
  // E♭–Cm–A♭–B♭ in E♭ major: a glockenspiel tune with pizzicato on the
  // off-beats, a bouncing bass and a light beat. Playful, for a month of
  // children.
  playful: {
    bpm: 104,
    bars: 8,
    key: 'E♭ major',
    padAttack: 0.6,
    chords: [
      { name: 'E♭', bass: 51, pad: [55, 58, 63], tones: [75, 79, 82, 87] },
      { name: 'Cm', bass: 48, pad: [55, 60, 63], tones: [72, 75, 79, 84] },
      { name: 'A♭', bass: 44, pad: [56, 60, 63], tones: [72, 75, 80, 84] },
      { name: 'B♭', bass: 46, pad: [53, 58, 62], tones: [70, 74, 77, 82] },
    ],
    parts: {
      pad: [[0, 8, 0.28]],
      bell: [
        [0, 2, 1, 0.5], [1, 1, 0.5, 0.4], [1.5, 2, 0.5, 0.38], [2, 3, 1.5, 0.48],
        [4, 1, 1, 0.45], [5, 0, 0.5, 0.38], [5.5, 1, 0.5, 0.36], [6, 2, 2, 0.45],
      ],
      pizz: twice([[0.5, 0, 0.3, 0.4, -1], [1.5, 1, 0.3, 0.35, -1], [2.5, 2, 0.3, 0.4, -1], [3.5, 1, 0.3, 0.35, -1]]),
      bass: [[0, 0, 1, 0.55], [2, 0, 1, 0.45], [4, 0, 1, 0.5], [6, 0, 1, 0.42], [7, 1, 0.5, 0.32]],
      kick: twice([[0, 0.35], [2, 0.3]]),
      clap: twice([[1, 0.28], [3, 0.32]]),
    },
  },
}

const trackOf = (trackId) => TRACKS[trackId] || TRACKS.warm
const meterOf = (track) => track.meter || BEATS_PER_BAR

// The order the tracks take turns in, month by month, with a quiet one never
// next to another quiet one. Eight does not go into twelve, so the same month
// a year later has a different track too: October 2027 does not sound like
// October 2026.
export const TRACK_ORDER = ['warm', 'pop', 'calm', 'folk', 'lofi', 'bright', 'waltz', 'playful']

/**
 * The track for a best-of's month ('YYYY-MM'): each month the next one of
 * TRACK_ORDER, so no two months in a row sound the same. Warm for anything
 * that is not a month.
 */
export function trackForMonth(monthKey) {
  const parsed = parseMonthKey(monthKey)
  if (!parsed) return 'warm'
  const index = (parsed.year * 12 + parsed.month) % TRACK_ORDER.length
  return TRACK_ORDER[index]
}

/**
 * Whether a track has a kick to pulse to: the story's photos give a little
 * on its beat (BestOfViewer.jsx), which under a track without drums would be
 * a beat nobody hears.
 */
export function hasPulse(trackId) {
  return Boolean(trackOf(trackId).parts.kick)
}

/**
 * How long from `elapsedMs` into a grid of beats `beatMs` apart until the
 * beat to keep to: the next one, or — when one went by less than 150 ms ago —
 * that one, as a negative time, how long ago it was. A slide ready a frame
 * after a beat then starts as if on it, rather than wait a whole beat.
 */
export function untilBeat(elapsedMs, beatMs) {
  if (elapsedMs < 0) return -elapsedMs
  const into = elapsedMs % beatMs
  return into < JUST_PASSED_MS ? -into : beatMs - into
}

/** One beat in milliseconds. The viewer times its slides in beats. */
export function beatMs(trackId) {
  return 60000 / trackOf(trackId).bpm
}

/** One bar in milliseconds: four beats, or three in a waltz. */
export function barMs(trackId) {
  const track = trackOf(trackId)
  return meterOf(track) * beatMs(trackId)
}

/**
 * One loop of a track as notes: { bpm, bars, meter, events }, each event
 * { beat, voice, midi, length, velocity }, sorted by beat. midi is null for
 * drums. Pure, so the same track always plays the same notes.
 */
export function arrangement(trackId) {
  const track = trackOf(trackId)
  const beatsPerChord = (track.bars * meterOf(track)) / track.chords.length
  const events = []
  track.chords.forEach((chord, index) => {
    for (const [voice, pattern] of Object.entries(track.parts)) {
      for (const step of pattern) {
        events.push(...notesOf(voice, step, chord, index * beatsPerChord))
      }
    }
  })
  events.sort((a, b) => a.beat - b.beat)
  return {
    bpm: track.bpm,
    bars: track.bars,
    meter: meterOf(track),
    // Played at exactly the written velocities, a loop sounds mechanical by its
    // third time round. The nudge is derived from the position, not random, so
    // it is the same every time.
    events: events.map((event, index) => ({
      ...event,
      velocity: Math.min(1, Math.max(0.05, event.velocity + (((index * 7) % 9) - 4) / 100)),
    })),
  }
}

function notesOf(voice, step, chord, offset) {
  if (voice === 'pad') {
    const [beat, length, velocity] = step
    return chord.pad.map((midi) => ({ beat: offset + beat, voice, midi, length, velocity }))
  }
  if (voice === 'bass') {
    const [beat, octave, length, velocity] = step
    return [{ beat: offset + beat, voice, midi: chord.bass + 12 * octave, length, velocity }]
  }
  if (DRUMS.has(voice)) {
    const [beat, velocity] = step
    return [{ beat: offset + beat, voice, midi: null, length: 0.25, velocity }]
  }
  const [beat, tone, length, velocity, octave = 0] = step
  return [{ beat: offset + beat, voice, midi: chord.tones[tone] + 12 * octave, length, velocity }]
}

// ── Playing it ──────────────────────────────────────────────────────────────

// Notes are handed to the audio clock a little ahead of time, by a timer on
// the main thread. The viewer decodes photos on that thread, which can hold a
// timer up for a moment, so the lookahead is generous; it costs nothing here,
// because nothing already scheduled ever has to change. A pause suspends the
// whole context and a stop fades the master, neither of which waits for it.
const LOOKAHEAD = 0.2
const TICK_MS = 25
// A note the timer reaches this late still plays, a moment late. One later
// than that (a throttled background tab) is skipped, rather than all of them
// sounding at once.
const LATE = 0.1
const START_DELAY = 0.05
const JUST_PASSED_MS = 150

const MASTER_LEVEL = 0.75
const FADE_IN = 1.5
const PAUSE_FADE = 0.08
const RESUME_FADE = 0.25

const REVERB_SECONDS = 2
const REVERB_WET = 0.2
const NOISE_SECONDS = 1
const STRING_SECONDS = 2.5

// The peak of one note at full velocity, before the master. The keys or the
// pluck carry the tune; pad and bass sit under them; the drums are only just
// there. The pad's level is per oscillator, two to a note.
//
// Balanced for a phone, which is where a best-of is mostly watched: its
// speaker plays nothing much below 200 Hz, so a mix that put its weight in
// the bass and the kick — this one did at first, with three quarters of its
// energy under 150 Hz — comes out thin, and loud only where nobody hears it.
const LEVELS = {
  pad: 0.045,
  keys: 0.2,
  pluck: 0.24,
  bass: 0.13,
  kick: 0.3,
  shaker: 0.14,
  clap: 0.16,
  string: 0.55,
  bell: 0.14,
  pizz: 0.17,
  arp: 0.075,
}

const SILENT = Object.freeze({
  start() {},
  pause() {},
  resume() {},
  stop() {},
  isPlaying: () => false,
  untilNextBeat: () => null,
})

/**
 * A player for a track on the given context, looping until stopped:
 * { start(), pause(), resume(), stop({ fadeMs }), isPlaying(),
 * untilNextBeat() }. Without a context every method does nothing, so the
 * viewer need not check for one.
 *
 * pause() suspends the context itself: its clock stops, and the notes already
 * handed to it wait, to carry on exactly where they were on resume(). The
 * context is the best-of's alone (utils/audioContext.js), so that is safe.
 */
export function createSoundtrack(context, trackId) {
  if (!context) return SILENT

  const { bpm, bars, meter, events } = arrangement(trackId)
  const { padAttack } = trackOf(trackId)
  const beat = 60 / bpm
  const loopSeconds = bars * meter * beat

  let state = 'idle' // → playing ⇄ paused → stopped
  let chain = null
  let timer = null
  let pending = null // the suspend after a pause's fade, or the teardown after a stop's
  let origin = 0
  let loop = 0
  let next = 0
  let hits = 0
  const live = new Set()

  function schedule() {
    const now = context.currentTime
    const horizon = now + LOOKAHEAD
    while (events.length) {
      const event = events[next]
      const at = origin + loop * loopSeconds + event.beat * beat
      if (at >= horizon) return
      if (at >= now - LATE) play(event, Math.max(at, now))
      next += 1
      if (next === events.length) {
        next = 0
        loop += 1
      }
    }
  }

  function play(event, at) {
    hits += 1
    const note = {
      at,
      end: at + event.length * beat,
      f: event.midi == null ? 0 : 440 * 2 ** ((event.midi - 69) / 12),
      velocity: event.velocity,
      peak: LEVELS[event.voice] * event.velocity,
      attack: padAttack,
      // Each hit starts somewhere else in the shared noise, so no two shakes
      // are the same few milliseconds of it.
      offset: (hits * 0.137) % (NOISE_SECONDS - 0.4),
    }
    const played = VOICES[event.voice](context, chain.inputs[event.voice], note, chain)
    live.add(played)
    // Every source of a note stops at the same moment, so the first one's end
    // releases the lot. A long session would otherwise keep every note it
    // ever played connected.
    played.sources[0].onended = () => release(played)
  }

  function release(played) {
    for (const node of played.nodes) node.disconnect()
    live.delete(played)
  }

  function fadeTo(level, seconds) {
    const gain = chain.master.gain
    const now = context.currentTime
    // Hold the level the gain has reached, mid-fade or not, and ramp from
    // there. Firefox has no cancelAndHoldAtTime.
    if (gain.cancelAndHoldAtTime) {
      gain.cancelAndHoldAtTime(now)
    } else {
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(gain.value, now)
    }
    gain.linearRampToValueAtTime(level, now + seconds)
  }

  function clearPending() {
    clearTimeout(pending)
    pending = null
  }

  function teardown() {
    clearInterval(timer)
    timer = null
    clearPending()
    for (const played of [...live]) {
      for (const source of played.sources) quietly(() => source.stop())
      release(played)
    }
    quietly(() => chain.drift.stop())
    for (const node of chain.nodes) node.disconnect()
    chain = null
  }

  return {
    // Works on a suspended context too: the notes wait on its stopped clock
    // and play once it is resumed.
    start() {
      if (state !== 'idle') return
      try {
        chain = buildChain(context)
      } catch {
        // A context that cannot build the chain (closed, or too old for a
        // node type) gets a best-of without music.
        state = 'stopped'
        return
      }
      state = 'playing'
      const now = context.currentTime
      origin = now + START_DELAY
      chain.master.gain.setValueAtTime(0, now)
      chain.master.gain.linearRampToValueAtTime(MASTER_LEVEL, now + FADE_IN)
      schedule()
      timer = setInterval(schedule, TICK_MS)
    },
    pause() {
      if (state !== 'playing') return
      state = 'paused'
      fadeTo(0, PAUSE_FADE)
      clearPending()
      pending = setTimeout(() => {
        pending = null
        clearInterval(timer)
        timer = null
        quietly(() => context.suspend())
      }, PAUSE_FADE * 1000)
    },
    resume() {
      if (state !== 'paused') return
      state = 'playing'
      clearPending()
      quietly(() => context.resume())
      // Scheduled on the clock as it stands: if it is stopped, the ramp waits
      // with everything else and plays once the context runs again.
      fadeTo(MASTER_LEVEL, RESUME_FADE)
      if (!timer) timer = setInterval(schedule, TICK_MS)
    },
    stop({ fadeMs = 600 } = {}) {
      if (state === 'stopped') return
      const was = state
      state = 'stopped'
      clearPending()
      if (was === 'idle') return
      // Paused means already faded out, or about to be.
      const delay = was === 'paused' ? PAUSE_FADE * 1000 : Math.max(0, fadeMs)
      if (was === 'playing') fadeTo(0, delay / 1000)
      if (delay === 0) teardown()
      else pending = setTimeout(teardown, delay)
    },
    isPlaying: () => state === 'playing',
    // How long until the music's beat to keep to, in milliseconds (see
    // untilBeat), so the story can cut on it: null while it is not playing.
    untilNextBeat() {
      if (state !== 'playing') return null
      return untilBeat((context.currentTime - origin) * 1000, beat * 1000)
    },
  }
}

// A browser may throw or reject where it refuses (a suspend on a closed
// context, a resume without a gesture). The music is a nicety: it goes quiet,
// it does not take the best-of down with it.
function quietly(action) {
  try {
    Promise.resolve(action()).catch(() => {})
  } catch {
    // See above.
  }
}

// ── The sound ───────────────────────────────────────────────────────────────

function oscillator(ctx, type, frequency) {
  const node = ctx.createOscillator()
  node.type = type
  node.frequency.value = frequency
  return node
}

function gainNode(ctx, value) {
  const node = ctx.createGain()
  node.gain.value = value
  return node
}

function filter(ctx, type, frequency, q = 0.7) {
  const node = ctx.createBiquadFilter()
  node.type = type
  node.frequency.value = frequency
  node.Q.value = q
  return node
}

// Up to `peak` in `attack`, then an exponential fall toward peak × sustain,
// and from `end` an exponential release from wherever the note has got to.
// Returns when the note is down by some 55 dB, which is when it stops.
function envelope(param, at, { peak, attack, decay, sustain, end, release }) {
  const releaseAt = Math.max(end, at + attack)
  param.setValueAtTime(0, at)
  param.linearRampToValueAtTime(peak, at + attack)
  param.setTargetAtTime(peak * sustain, at + attack, decay)
  param.setTargetAtTime(0, releaseAt, release)
  return releaseAt + release * 6.5
}

function run(sources, nodes, at, stopAt) {
  for (const source of sources) {
    source.start(at)
    source.stop(stopAt)
  }
  return { sources, nodes }
}

const VOICES = {
  // Two drawn-out sawtooths a few cents apart, under a lowpass at 900 Hz: a
  // string-like wash with the edge taken off.
  pad(ctx, out, { at, end, f, peak, attack }) {
    const amp = gainNode(ctx, 0)
    const saws = [-7, 7].map((cents) => {
      const saw = oscillator(ctx, 'sawtooth', f)
      saw.detune.value = cents
      saw.connect(amp)
      return saw
    })
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack, decay: 1, sustain: 1, end, release: 0.5 })
    return run(saws, [...saws, amp], at, stopAt)
  },

  // An electric piano from two sines. The modulator bends the carrier's
  // waveform, brightly at the strike and less and less after, the way a tine
  // sounds. It is a cosine because a sine at the carrier's own pitch would add
  // a DC offset that rises and falls with every note.
  keys(ctx, out, { at, end, f, peak, velocity }, chain) {
    const carrier = oscillator(ctx, 'sine', f)
    const modulator = ctx.createOscillator()
    modulator.setPeriodicWave(chain.cosine)
    modulator.frequency.value = f
    const depth = gainNode(ctx, 0)
    depth.gain.setValueAtTime(f * (0.3 + 1.5 * velocity), at)
    depth.gain.setTargetAtTime(f * 0.08, at, 0.35)
    const amp = gainNode(ctx, 0)
    modulator.connect(depth)
    depth.connect(carrier.frequency)
    carrier.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.006, decay: 1.4, sustain: 0.3, end, release: 0.2 })
    return run([carrier, modulator], [carrier, modulator, depth, amp], at, stopAt)
  },

  // A struck bar: a triangle that dies away, and a quiet sine two octaves up
  // that is gone almost at once, as a marimba's overtone is.
  pluck(ctx, out, { at, f, peak }) {
    const body = oscillator(ctx, 'triangle', f)
    const overtone = oscillator(ctx, 'sine', f * 4)
    const bodyAmp = gainNode(ctx, 0)
    const overtoneAmp = gainNode(ctx, 0)
    body.connect(bodyAmp)
    overtone.connect(overtoneAmp)
    bodyAmp.connect(out)
    overtoneAmp.connect(out)
    const stopAt = envelope(bodyAmp.gain, at, { peak, attack: 0.003, decay: 0.45, sustain: 0, end: at, release: 0.3 })
    envelope(overtoneAmp.gain, at, { peak: peak * 0.3, attack: 0.002, decay: 0.03, sustain: 0, end: at, release: 0.03 })
    return run([body, overtone], [body, overtone, bodyAmp, overtoneAmp], at, stopAt)
  },

  // A triangle for overtones a phone speaker can play, and a sine at the same
  // pitch for roundness. The sine doubles the fundamental rather than sitting
  // an octave under it: an octave under D2 is 37 Hz, which a phone cannot
  // play and which would only push the compressor.
  bass(ctx, out, { at, end, f, peak }) {
    const amp = gainNode(ctx, 0)
    const body = oscillator(ctx, 'triangle', f)
    const sub = oscillator(ctx, 'sine', f)
    body.connect(amp)
    sub.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.012, decay: 0.5, sustain: 0.6, end, release: 0.06 })
    return run([body, sub], [body, sub, amp], at, stopAt)
  },

  // A plucked guitar string, Karplus–Strong: a burst of noise going round a
  // loop one period long, softened a little each time round, as a string
  // loses its overtones first. It is worked out once per pitch, ahead of
  // time (stringBuffer), since a feedback loop of Web Audio nodes cannot be
  // shorter than 128 samples and so could not play anything above E4.
  string(ctx, out, { at, end, f, peak }) {
    const { buffer, rate } = stringBuffer(ctx, f)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const amp = gainNode(ctx, 0)
    source.connect(amp)
    amp.connect(out)
    const ring = buffer.length / buffer.sampleRate / rate
    const stopAt = Math.min(
      at + ring,
      envelope(amp.gain, at, { peak, attack: 0.002, decay: 2, sustain: 1, end: end + 0.4, release: 0.25 }),
    )
    return run([source], [source, amp], at, stopAt)
  },

  // A struck metal bar, glockenspiel or music box: three sines at the
  // inharmonic ratios of a bar, the upper ones dying first.
  bell(ctx, out, { at, f, peak }) {
    const sources = []
    const nodes = []
    let stopAt = at
    for (const [ratio, level, decay] of [[1, 1, 0.9], [2.76, 0.32, 0.35], [5.4, 0.12, 0.12]]) {
      const tone = oscillator(ctx, 'sine', f * ratio)
      const amp = gainNode(ctx, 0)
      tone.connect(amp)
      amp.connect(out)
      const end = envelope(amp.gain, at, { peak: peak * level, attack: 0.002, decay, sustain: 0, end: at, release: decay })
      stopAt = Math.max(stopAt, end)
      sources.push(tone)
      nodes.push(tone, amp)
    }
    return run(sources, nodes, at, stopAt)
  },

  // Pizzicato: a triangle with a little sawtooth for the bite of the string,
  // gone in a tenth of a second.
  pizz(ctx, out, { at, f, peak }) {
    const amp = gainNode(ctx, 0)
    const body = oscillator(ctx, 'triangle', f)
    const edge = oscillator(ctx, 'sawtooth', f)
    const edgeAmp = gainNode(ctx, 0.25)
    body.connect(amp)
    edge.connect(edgeAmp)
    edgeAmp.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.004, decay: 0.12, sustain: 0, end: at, release: 0.08 })
    return run([body, edge], [body, edge, edgeAmp, amp], at, stopAt)
  },

  // A synth arpeggio: a square wave, short, through a low lowpass so that it
  // is round rather than buzzing.
  arp(ctx, out, { at, end, f, peak }) {
    const tone = oscillator(ctx, 'square', f)
    const amp = gainNode(ctx, 0)
    tone.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.004, decay: 0.15, sustain: 0.25, end, release: 0.06 })
    return run([tone], [tone, amp], at, stopAt)
  },

  // A sine dropping from 110 to 45 Hz: a thump, with no click on top.
  kick(ctx, out, { at, peak }) {
    const body = oscillator(ctx, 'sine', 110)
    body.frequency.setValueAtTime(110, at)
    body.frequency.exponentialRampToValueAtTime(45, at + 0.15)
    const amp = gainNode(ctx, 0)
    body.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.004, decay: 0.12, sustain: 0, end: at, release: 0.12 })
    return run([body], [body, amp], at, stopAt)
  },

  shaker(ctx, out, { at, peak, offset }, chain) {
    const noise = ctx.createBufferSource()
    noise.buffer = chain.noise
    const amp = gainNode(ctx, 0)
    noise.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.012, decay: 0.035, sustain: 0, end: at, release: 0.035 })
    noise.start(at, offset)
    noise.stop(stopAt)
    return { sources: [noise], nodes: [noise, amp] }
  },

  // Three bursts a few milliseconds apart and a short tail, the way a clap is
  // several hands, through a bandpass that keeps it soft.
  clap(ctx, out, { at, peak, offset }, chain) {
    const noise = ctx.createBufferSource()
    noise.buffer = chain.noise
    const amp = gainNode(ctx, 0)
    noise.connect(amp)
    amp.connect(out)
    amp.gain.setValueAtTime(0, at)
    for (const [delay, level, fall] of [[0, 1, 0.004], [0.011, 0.75, 0.004], [0.022, 0.9, 0.05]]) {
      amp.gain.setValueAtTime(peak * level, at + delay)
      amp.gain.setTargetAtTime(0, at + delay, fall)
    }
    const stopAt = at + 0.022 + 0.05 * 6.5
    noise.start(at, offset)
    noise.stop(stopAt)
    return { sources: [noise], nodes: [noise, amp] }
  },
}

// voices → their filters → bus → dry, and a dark reverb → compressor → master.
function buildChain(ctx) {
  const { impulse, noise } = buffersFor(ctx)
  const nodes = []
  const keep = (node) => {
    nodes.push(node)
    return node
  }

  const master = keep(gainNode(ctx, 0))
  const compressor = keep(ctx.createDynamicsCompressor())
  compressor.threshold.value = -14
  compressor.knee.value = 12
  compressor.ratio.value = 2.5
  compressor.attack.value = 0.02
  compressor.release.value = 0.3
  const bus = keep(gainNode(ctx, 1))
  // The reverb hears nothing below 250 Hz, so bass and kick stay dry and
  // tight instead of turning into a rumble.
  const send = keep(filter(ctx, 'highpass', 250))
  const reverb = keep(ctx.createConvolver())
  reverb.buffer = impulse
  const wet = keep(gainNode(ctx, REVERB_WET))
  bus.connect(compressor)
  bus.connect(send)
  send.connect(reverb)
  reverb.connect(wet)
  wet.connect(compressor)
  compressor.connect(master)
  master.connect(ctx.destination)

  // One set of filters per voice, shared by all its notes, rather than one
  // filter per note.
  const input = (...stages) => {
    stages.forEach(keep)
    stages.reduce((from, to) => from.connect(to))
    stages[stages.length - 1].connect(bus)
    return stages[0]
  }
  const padFilter = filter(ctx, 'lowpass', 900)
  const inputs = {
    pad: input(padFilter),
    keys: input(filter(ctx, 'lowpass', 3200)),
    pluck: input(filter(ctx, 'lowpass', 2500)),
    // High enough to let the triangle's overtones through: on a phone they
    // are the bass line, its fundamentals being too low to play.
    bass: input(filter(ctx, 'lowpass', 700)),
    kick: bus,
    shaker: input(filter(ctx, 'highpass', 5000), filter(ctx, 'lowpass', 9000)),
    clap: input(filter(ctx, 'bandpass', 1400, 0.9)),
    string: input(filter(ctx, 'lowpass', 3500)),
    bell: input(filter(ctx, 'lowpass', 6000)),
    pizz: input(filter(ctx, 'lowpass', 2000)),
    arp: input(filter(ctx, 'lowpass', 1500)),
  }

  // The pad's lowpass drifts slowly up and down, so a held chord breathes
  // instead of standing still.
  const drift = keep(oscillator(ctx, 'sine', 0.07))
  const driftDepth = keep(gainNode(ctx, 180))
  drift.connect(driftDepth)
  driftDepth.connect(padFilter.frequency)
  drift.start()

  const cosine = ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]))
  return { master, inputs, nodes, drift, noise, cosine }
}

// The reverb's impulse response and the drums' noise are made once per
// context and shared by every note and every soundtrack on it.
const buffers = new WeakMap()

function buffersFor(ctx) {
  if (!buffers.has(ctx)) buffers.set(ctx, { impulse: impulseResponse(ctx), noise: whiteNoise(ctx), strings: new Map() })
  return buffers.get(ctx)
}

// A string's sound at one pitch, made the first time that pitch is played and
// kept with the context. The loop is a whole number of samples long, which
// would leave a note up to a few cents off; the playback rate makes up the
// difference. The noise is seeded from the pitch, so a note sounds the same
// every time it is struck.
function stringBuffer(ctx, f) {
  const { strings } = buffersFor(ctx)
  const key = Math.round(f * 100)
  if (strings.has(key)) return strings.get(key)
  const rate = ctx.sampleRate
  const period = Math.max(2, Math.round(rate / f))
  const length = Math.round(rate * STRING_SECONDS)
  const buffer = ctx.createBuffer(1, length, rate)
  const data = buffer.getChannelData(0)
  let seed = key >>> 0 || 1
  let smoothed = 0
  for (let i = 0; i < Math.min(period, length); i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    smoothed += 0.5 * ((seed / 2 ** 32) * 2 - 1 - smoothed)
    data[i] = smoothed
  }
  for (let i = period; i < length; i++) {
    data[i] = 0.996 * 0.5 * (data[i - period] + (i > period ? data[i - period - 1] : 0))
  }
  // The last few milliseconds fade out, so a string cut off by its buffer's
  // end does not click.
  const fade = Math.min(length, Math.round(rate * 0.05))
  for (let i = 0; i < fade; i++) data[length - 1 - i] *= i / fade
  // Averaging two neighbours delays the loop by half a sample.
  const made = { buffer, rate: f / (rate / (period + 0.5)) }
  strings.set(key, made)
  return made
}

function whiteNoise(ctx) {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

// A room, faked: noise that dies away by 60 dB over two seconds, different in
// each ear so it sounds wide. It is smoothed more and more as it decays, since
// a real room swallows the highs first, and a bright tail is what makes cheap
// reverb sound cheap.
function impulseResponse(ctx) {
  const length = Math.round(ctx.sampleRate * REVERB_SECONDS)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  const fall = Math.exp(-6.9 / length)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    let amplitude = 1
    let smoothed = 0
    for (let i = 0; i < length; i++) {
      smoothed += (0.6 - (0.5 * i) / length) * (Math.random() * 2 - 1 - smoothed)
      data[i] = smoothed * amplitude
      amplitude *= fall
    }
  }
  return buffer
}
