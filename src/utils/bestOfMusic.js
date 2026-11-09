// The best-of's soundtrack: background music made in the browser with the Web
// Audio API, from a few oscillators and a little noise. There are no audio
// files and no network: like the rest of the best-of, it never leaves the
// device.
//
// Eight tracks, each with its own progression, key, tempo, instruments and
// tune, taken in turn from month to month (see trackForMonth), so that one
// month's best-of does not sound like the last one's, and everyone in the
// family hears the same music under the same best-of. Each is a sixteen-bar
// loop, a chord every two bars and a melody over all sixteen, that goes round
// for as long as the story plays.
//
// The musical design follows from what plays over it: a family looking back
// at its month. The music is there to carry that feeling, not to drive it.
// The first version was dance music slowed down — up to 126 bpm, a dozen
// notes and five drum hits a second, a square-wave arpeggio, a sawtooth pad,
// claps, an eight-bar pattern and no tune — and sounded like it: quick,
// technical and the same every twenty seconds. So now:
//
// - Every track has a melody, sung by one instrument over the accompaniment,
//   because a tune is what people feel; a pattern is only what they tap.
// - The tempos are those of a ballad, 64 to 80 bpm. The story times its
//   slides and cuts in beats, so it slows down with the music, too.
// - The instruments are ones people know from records — a piano, strings, a
//   cello, a guitar, a harp, a music box, an electric piano — modelled
//   rather than taken from the synthesiser's basic waveforms, and played
//   with what makes them sound played: a piano's hammer brightness that
//   fades, strings that swell and then find their vibrato.
// - Drums only in a few tracks, and then a felt kick like a heartbeat and a
//   brush, never a clap.
// - The loop is sixteen bars, the second eight answering the first, so it
//   goes round only every forty seconds or so.
//
// It still mostly plays from a phone speaker, so nothing starts with a hard
// edge, every voice with upper harmonics goes through a lowpass, the low notes
// have overtones a phone can play, the reverb is dark, and a gentle compressor
// keeps a pile-up of notes from getting loud. The whole mix peaks well below
// full scale.
import { parseMonthKey } from './bestOf'

const BEATS_PER_BAR = 4
const DRUMS = new Set(['kick', 'brush'])
const ON_THE_BASS = new Set(['bass', 'cello'])

// Steps of a pattern, one chord (two bars) long, by voice:
//   pad                    [beat, length, velocity], for every note of chord.pad
//   piano, keys, string,
//   bell                   [beat, tone, length, velocity, octave?], tone indexes
//                          chord.tones, octave moves it by twelve
//   bass, cello            [beat, octave, length, velocity], on chord.bass
//   kick, brush            [beat, velocity]
// and the melody, over the whole loop, played by `melody.voice`:
//                          [beat, midi, length, velocity]
// Lengths are in beats; a note may ring past the end of its chord, or of the
// loop, into the next one. A bar has four beats unless the track says
// otherwise (`meter`), as the lullaby does.
const twice = (bar) => [...bar, ...bar.map(([beat, ...rest]) => [beat + BEATS_PER_BAR, ...rest])]

// Voicings are written out as MIDI notes (60 is middle C) rather than derived,
// so what plays is what is read here. The pad moves by step from chord to
// chord, the way a string section would.
export const TRACKS = {
  // A piano on its own, over strings so quiet they are more felt than heard:
  // I–vi–IV–V in D major, then IV–V–iii–vi, broken chords in the left hand
  // and a tune in the right. Remembering.
  warm: {
    bpm: 72,
    bars: 16,
    key: 'D major',
    padAttack: 1.5,
    chords: [
      { name: 'D', bass: 38, pad: [57, 62, 66], tones: [50, 57, 62, 66] },
      { name: 'Bm', bass: 35, pad: [59, 62, 66], tones: [47, 54, 59, 62] },
      { name: 'G', bass: 43, pad: [59, 62, 67], tones: [43, 50, 59, 62] },
      { name: 'A', bass: 45, pad: [57, 61, 64], tones: [45, 52, 57, 61] },
      { name: 'G', bass: 43, pad: [59, 62, 67], tones: [43, 50, 59, 62] },
      { name: 'A', bass: 45, pad: [57, 61, 64], tones: [45, 52, 57, 61] },
      { name: 'F♯m', bass: 42, pad: [57, 61, 66], tones: [42, 49, 57, 61] },
      { name: 'Bm', bass: 35, pad: [59, 62, 66], tones: [47, 54, 59, 62] },
    ],
    parts: {
      pad: [[0, 8, 0.32]],
      piano: [
        [0, 0, 3, 0.42], [0.5, 1, 2.5, 0.3], [1, 2, 2, 0.32], [1.5, 3, 2, 0.28],
        [2, 2, 1.5, 0.3], [2.5, 1, 1.5, 0.27], [3, 2, 1, 0.29], [3.5, 3, 1, 0.26],
        [4, 0, 3, 0.4], [4.5, 1, 2.5, 0.3], [5, 2, 2, 0.31], [5.5, 3, 2, 0.28],
        [6, 2, 1.5, 0.29], [7, 1, 1, 0.26],
      ],
    },
    melody: {
      voice: 'piano',
      notes: [
        [0, 78, 1.5, 0.72], [1.5, 76, 0.5, 0.58], [2, 74, 1, 0.62], [3, 69, 1, 0.56],
        [4, 74, 1, 0.62], [5, 76, 1, 0.64], [6, 78, 2, 0.7],
        [8, 78, 1, 0.66], [9, 76, 1, 0.6], [10, 74, 2, 0.64], [12, 71, 1, 0.56], [13, 73, 1, 0.58], [14, 74, 2, 0.62],
        [16, 71, 1, 0.58], [17, 74, 1, 0.62], [18, 79, 2, 0.74], [20, 78, 1, 0.66], [21, 76, 1, 0.62], [22, 74, 2, 0.64],
        [24, 73, 1.5, 0.62], [25.5, 74, 0.5, 0.56], [26, 76, 2, 0.66], [28, 69, 4, 0.58],
        [32, 71, 1, 0.58], [33, 74, 1, 0.62], [34, 79, 1.5, 0.74], [35.5, 78, 0.5, 0.62], [36, 76, 1, 0.64],
        [37, 74, 1, 0.6], [38, 71, 2, 0.6],
        [40, 73, 1, 0.6], [41, 76, 1, 0.66], [42, 81, 2, 0.78], [44, 79, 1, 0.7], [45, 78, 1, 0.66], [46, 76, 2, 0.66],
        [48, 78, 2, 0.7], [50, 73, 1, 0.6], [51, 76, 1, 0.64], [52, 81, 2, 0.76], [54, 78, 2, 0.66],
        [56, 74, 2, 0.62], [58, 73, 1, 0.58], [59, 71, 1, 0.56], [60, 74, 2, 0.6], [62, 73, 2, 0.6],
      ],
    },
  },
  // Am–F–C–G, the progression of a hundred hopeful songs, starting in the
  // minor: a piano rolling in eighths, a cello under it, strings, and a felt
  // kick like a slow heartbeat with a brush on two and four.
  hope: {
    bpm: 70,
    bars: 16,
    key: 'C major',
    padAttack: 1.2,
    chords: [
      { name: 'Am', bass: 45, pad: [57, 60, 64], tones: [45, 52, 57, 60, 64] },
      { name: 'F', bass: 41, pad: [57, 60, 65], tones: [41, 48, 53, 57, 60] },
      { name: 'C', bass: 48, pad: [55, 60, 64], tones: [48, 55, 60, 64, 67] },
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [43, 50, 55, 59, 62] },
      { name: 'Am', bass: 45, pad: [57, 60, 64], tones: [45, 52, 57, 60, 64] },
      { name: 'F', bass: 41, pad: [57, 60, 65], tones: [41, 48, 53, 57, 60] },
      { name: 'C', bass: 48, pad: [55, 60, 64], tones: [48, 55, 60, 64, 67] },
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [43, 50, 55, 59, 62] },
    ],
    parts: {
      pad: [[0, 8, 0.36]],
      cello: [[0, 0, 8, 0.5]],
      piano: [
        [0, 0, 2, 0.4], [0.5, 1, 1.5, 0.28], [1, 2, 1.5, 0.3], [1.5, 3, 1.5, 0.27],
        [2, 4, 2, 0.31], [2.5, 3, 1, 0.26], [3, 2, 1, 0.28], [3.5, 1, 1, 0.25],
        [4, 0, 2, 0.38], [4.5, 1, 1.5, 0.27], [5, 2, 1.5, 0.29], [5.5, 3, 1.5, 0.27],
        [6, 4, 2, 0.3], [7, 3, 1, 0.25],
      ],
      kick: [[0, 0.32], [4, 0.26]],
      brush: twice([[1, 0.22], [3, 0.26]]),
    },
    melody: {
      voice: 'piano',
      notes: [
        [0, 76, 1.5, 0.7], [1.5, 74, 0.5, 0.58], [2, 72, 1, 0.62], [3, 71, 1, 0.58], [4, 72, 2, 0.64], [6, 69, 2, 0.6],
        [8, 69, 1, 0.58], [9, 72, 1, 0.62], [10, 77, 2, 0.72], [12, 76, 1.5, 0.66], [13.5, 74, 0.5, 0.58], [14, 72, 2, 0.62],
        [16, 76, 2, 0.68], [18, 79, 2, 0.74], [20, 76, 1, 0.64], [21, 74, 1, 0.62], [22, 72, 2, 0.62],
        [24, 74, 3, 0.66], [27, 71, 1, 0.58], [28, 67, 4, 0.58],
        [32, 76, 1.5, 0.7], [33.5, 74, 0.5, 0.58], [34, 72, 1, 0.62], [35, 71, 1, 0.58], [36, 72, 1, 0.62],
        [37, 76, 1, 0.66], [38, 81, 2, 0.78],
        [40, 81, 1.5, 0.74], [41.5, 79, 0.5, 0.64], [42, 77, 2, 0.7], [44, 76, 1, 0.64], [45, 72, 1, 0.6], [46, 69, 2, 0.6],
        [48, 67, 1, 0.58], [49, 72, 1, 0.62], [50, 76, 2, 0.68], [52, 79, 1.5, 0.72], [53.5, 77, 0.5, 0.62], [54, 76, 2, 0.66],
        [56, 74, 2, 0.64], [58, 71, 1, 0.58], [59, 74, 1, 0.6], [60, 71, 4, 0.58],
      ],
    },
  },
  // Strings and a cello alone, with a piano now and then: Fmaj7–Am7–B♭maj7–C,
  // then Dm7, and a suspension that lets the loop sigh back to its start.
  // The slowest of them, and the only one with nothing that ticks. For winter.
  calm: {
    bpm: 64,
    bars: 16,
    key: 'F major',
    padAttack: 2,
    chords: [
      { name: 'Fmaj7', bass: 41, pad: [53, 57, 60, 64], tones: [53, 57, 60, 64] },
      { name: 'Am7', bass: 45, pad: [52, 55, 60, 64], tones: [52, 57, 60, 64] },
      { name: 'B♭maj7', bass: 46, pad: [53, 57, 58, 62], tones: [46, 53, 57, 62] },
      { name: 'C', bass: 48, pad: [52, 55, 60, 64], tones: [48, 55, 60, 64] },
      { name: 'Dm7', bass: 50, pad: [53, 57, 60, 62], tones: [50, 57, 60, 65] },
      { name: 'Am7', bass: 45, pad: [52, 55, 60, 64], tones: [52, 57, 60, 64] },
      { name: 'B♭maj7', bass: 46, pad: [53, 57, 58, 62], tones: [46, 53, 57, 62] },
      { name: 'Csus4', bass: 48, pad: [53, 55, 60, 65], tones: [48, 55, 60, 65] },
    ],
    parts: {
      pad: [[0, 8, 0.62]],
      cello: [[0, 0, 8, 0.7]],
      piano: [[0, 0, 4, 0.3], [1.5, 2, 3, 0.24], [3, 3, 3, 0.24], [4.5, 1, 3, 0.22], [6, 2, 2, 0.22]],
    },
    melody: {
      voice: 'piano',
      notes: [
        [0, 72, 2, 0.6], [2, 69, 1, 0.54], [3, 72, 1, 0.56], [4, 76, 4, 0.64],
        [8, 76, 2, 0.62], [10, 72, 2, 0.56], [12, 69, 4, 0.54],
        [16, 74, 2, 0.6], [18, 77, 2, 0.64], [20, 74, 2, 0.58], [22, 72, 2, 0.56],
        [24, 72, 2, 0.58], [26, 74, 1, 0.58], [27, 76, 1, 0.6], [28, 79, 4, 0.66],
        [32, 77, 2, 0.64], [34, 76, 1, 0.6], [35, 74, 1, 0.58], [36, 69, 4, 0.54],
        [40, 72, 2, 0.58], [42, 76, 2, 0.62], [44, 79, 3, 0.68], [47, 76, 1, 0.58],
        [48, 77, 3, 0.66], [51, 76, 1, 0.6], [52, 74, 2, 0.58], [54, 72, 2, 0.56],
        [56, 72, 4, 0.58], [60, 67, 4, 0.52],
      ],
    },
  },
  // A guitar picked in eighths, the thumb on the low strings and the fingers
  // above, and a piano singing over it: C–G/B–Am–F, then C–G/B–F–G. A brush
  // and a kick that is barely there.
  folk: {
    bpm: 80,
    bars: 16,
    key: 'C major',
    padAttack: 1,
    chords: [
      { name: 'C', bass: 36, pad: [55, 60, 64], tones: [48, 55, 60, 64, 67] },
      { name: 'G/B', bass: 47, pad: [55, 59, 62], tones: [47, 55, 59, 62, 67] },
      { name: 'Am', bass: 45, pad: [57, 60, 64], tones: [45, 52, 57, 60, 64] },
      { name: 'F', bass: 41, pad: [57, 60, 65], tones: [41, 48, 53, 57, 60] },
      { name: 'C', bass: 36, pad: [55, 60, 64], tones: [48, 55, 60, 64, 67] },
      { name: 'G/B', bass: 47, pad: [55, 59, 62], tones: [47, 55, 59, 62, 67] },
      { name: 'F', bass: 41, pad: [57, 60, 65], tones: [41, 48, 53, 57, 60] },
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [43, 50, 55, 59, 62] },
    ],
    parts: {
      pad: [[0, 8, 0.2]],
      string: twice([
        [0, 0, 1.5, 0.52], [0.5, 3, 1, 0.34], [1, 1, 1.5, 0.42], [1.5, 4, 1, 0.34],
        [2, 0, 1.5, 0.45], [2.5, 3, 1, 0.32], [3, 1, 1.5, 0.38], [3.5, 2, 1, 0.3],
      ]),
      kick: [[0, 0.22], [4, 0.18]],
      brush: twice([[1, 0.2], [3, 0.24]]),
    },
    melody: {
      voice: 'piano',
      notes: [
        [0, 76, 1, 0.64], [1, 74, 0.5, 0.56], [1.5, 72, 0.5, 0.56], [2, 72, 2, 0.6],
        [4, 67, 1, 0.54], [5, 72, 1, 0.58], [6, 74, 1, 0.6], [7, 76, 1, 0.62],
        [8, 74, 3, 0.64], [11, 71, 1, 0.56], [12, 67, 4, 0.56],
        [16, 72, 1, 0.6], [17, 71, 0.5, 0.54], [17.5, 69, 0.5, 0.54], [18, 69, 2, 0.58],
        [20, 72, 1, 0.58], [21, 76, 1, 0.62], [22, 79, 2, 0.7],
        [24, 77, 2, 0.68], [26, 76, 1, 0.62], [27, 74, 1, 0.6], [28, 72, 4, 0.6],
        [32, 76, 1, 0.64], [33, 79, 1, 0.68], [34, 79, 2, 0.7], [36, 76, 1, 0.62], [37, 72, 1, 0.58],
        [38, 74, 1, 0.6], [39, 76, 1, 0.62],
        [40, 74, 2, 0.64], [42, 71, 1, 0.56], [43, 74, 1, 0.6], [44, 74, 4, 0.6],
        [48, 72, 1, 0.58], [49, 74, 0.5, 0.56], [49.5, 72, 0.5, 0.54], [50, 69, 2, 0.56],
        [52, 69, 1, 0.56], [53, 72, 1, 0.58], [54, 77, 2, 0.68],
        [56, 74, 2, 0.62], [58, 71, 2, 0.58], [60, 67, 4, 0.54],
      ],
    },
  },
  // E♭maj7–Dm7–Cm7–F7 in B♭ major, slow and swung: rolled electric-piano
  // chords that sing the tune too, a round bass and a soft, late brush — the
  // end of a long day.
  dusk: {
    bpm: 68,
    bars: 16,
    key: 'B♭ major',
    padAttack: 1.5,
    chords: [
      { name: 'E♭maj7', bass: 39, pad: [55, 58, 62], tones: [51, 55, 58, 62] },
      { name: 'Dm7', bass: 38, pad: [53, 57, 60], tones: [50, 53, 57, 60] },
      { name: 'Cm7', bass: 36, pad: [51, 55, 58], tones: [48, 51, 55, 58] },
      { name: 'F7', bass: 41, pad: [51, 57, 60], tones: [53, 57, 60, 63] },
      { name: 'E♭maj7', bass: 39, pad: [55, 58, 62], tones: [51, 55, 58, 62] },
      { name: 'Dm7', bass: 38, pad: [53, 57, 60], tones: [50, 53, 57, 60] },
      { name: 'Cm7', bass: 36, pad: [51, 55, 58], tones: [48, 51, 55, 58] },
      { name: 'F7', bass: 41, pad: [51, 57, 60], tones: [53, 57, 60, 63] },
    ],
    parts: {
      pad: [[0, 8, 0.26]],
      keys: [
        [0, 1, 2.5, 0.36], [0.04, 2, 2.5, 0.32], [0.08, 3, 2.5, 0.32],
        [2.67, 2, 1, 0.28], [3, 1, 1, 0.28],
        [4, 1, 2.5, 0.34], [4.04, 2, 2.5, 0.3], [4.08, 3, 2.5, 0.3],
        [6.67, 3, 1, 0.26],
      ],
      bass: [
        [0, 0, 1.5, 0.6], [1.67, 0, 0.3, 0.32], [2, 1, 0.5, 0.3], [2.67, 0, 1.2, 0.42],
        [4, 0, 1.5, 0.55], [6, 0, 0.6, 0.38], [6.67, 1, 0.3, 0.28], [7.33, 0, 0.6, 0.32],
      ],
      kick: [[0, 0.3], [2.67, 0.2], [4, 0.28], [6.67, 0.18]],
      brush: twice([[1, 0.2], [1.67, 0.1], [3, 0.24], [3.67, 0.12]]),
    },
    melody: {
      voice: 'keys',
      notes: [
        [1, 67, 1, 0.6], [2, 70, 1, 0.62], [3, 74, 3, 0.68], [6.67, 72, 1.33, 0.6],
        [8, 69, 2, 0.6], [10, 72, 1, 0.6], [11, 74, 1, 0.62], [12, 77, 3, 0.7],
        [16, 75, 2, 0.66], [18, 74, 0.67, 0.6], [18.67, 72, 1.33, 0.6], [20, 67, 4, 0.58],
        [24, 69, 1, 0.58], [25, 72, 1, 0.6], [26, 75, 2, 0.66], [28, 72, 4, 0.6],
        [32, 70, 1, 0.6], [33, 74, 1, 0.64], [34, 79, 2, 0.72], [36, 77, 2, 0.68], [38, 74, 1, 0.62], [39, 75, 1, 0.62],
        [40, 77, 3, 0.7], [43, 74, 1, 0.62], [44, 69, 4, 0.58],
        [48, 79, 2, 0.72], [50, 75, 1, 0.64], [51, 74, 1, 0.62], [52, 72, 2, 0.6], [54, 70, 2, 0.58],
        [56, 69, 2, 0.58], [58, 72, 2, 0.6], [60, 72, 4, 0.58],
      ],
    },
  },
  // G–D/F♯–Em–C, the bass walking down under it, then G–D/F♯–C–D: a
  // guitar, a piano tune that reaches up, strings and a soft beat. Sunlight,
  // for summer.
  bright: {
    bpm: 76,
    bars: 16,
    key: 'G major',
    padAttack: 1,
    chords: [
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [43, 47, 50, 55, 59] },
      { name: 'D/F♯', bass: 42, pad: [54, 57, 62], tones: [42, 50, 54, 57, 62] },
      { name: 'Em', bass: 40, pad: [55, 59, 64], tones: [40, 47, 52, 55, 59] },
      { name: 'C', bass: 48, pad: [55, 60, 64], tones: [48, 52, 55, 60, 64] },
      { name: 'G', bass: 43, pad: [55, 59, 62], tones: [43, 47, 50, 55, 59] },
      { name: 'D/F♯', bass: 42, pad: [54, 57, 62], tones: [42, 50, 54, 57, 62] },
      { name: 'C', bass: 48, pad: [55, 60, 64], tones: [48, 52, 55, 60, 64] },
      { name: 'D', bass: 50, pad: [54, 57, 62], tones: [50, 54, 57, 62, 66] },
    ],
    parts: {
      pad: [[0, 8, 0.3]],
      string: twice([
        [0, 0, 2, 0.6], [0.5, 2, 1.5, 0.4], [1, 3, 1.5, 0.44], [1.5, 4, 1, 0.4],
        [2, 1, 1.5, 0.5], [2.5, 3, 1, 0.4], [3, 4, 1, 0.42], [3.5, 3, 1, 0.38],
      ]),
      kick: [[0, 0.3], [4, 0.25]],
      brush: twice([[1, 0.22], [3, 0.26]]),
    },
    melody: {
      voice: 'piano',
      notes: [
        [0, 71, 1, 0.6], [1, 74, 1, 0.62], [2, 79, 2, 0.72], [4, 78, 1, 0.66], [5, 76, 1, 0.62], [6, 74, 2, 0.64],
        [8, 74, 1, 0.62], [9, 76, 0.5, 0.6], [9.5, 78, 0.5, 0.62], [10, 78, 2, 0.68], [12, 76, 1, 0.62],
        [13, 74, 1, 0.6], [14, 69, 2, 0.58],
        [16, 71, 1, 0.6], [17, 76, 1, 0.64], [18, 79, 2, 0.72], [20, 78, 1, 0.66], [21, 76, 1, 0.62], [22, 71, 2, 0.6],
        [24, 72, 1, 0.6], [25, 76, 1, 0.64], [26, 79, 1.5, 0.7], [27.5, 78, 0.5, 0.62], [28, 76, 2, 0.64], [30, 74, 2, 0.62],
        [32, 71, 1, 0.6], [33, 74, 1, 0.62], [34, 79, 2, 0.72], [36, 81, 1, 0.74], [37, 79, 1, 0.68], [38, 74, 2, 0.64],
        [40, 78, 2, 0.68], [42, 76, 1, 0.62], [43, 74, 1, 0.6], [44, 74, 4, 0.62],
        [48, 76, 1.5, 0.66], [49.5, 74, 0.5, 0.58], [50, 72, 1, 0.6], [51, 76, 1, 0.62], [52, 79, 2, 0.7], [54, 76, 2, 0.64],
        [56, 78, 2, 0.68], [58, 76, 1, 0.62], [59, 74, 1, 0.6], [60, 69, 4, 0.56],
      ],
    },
  },
  // A–F♯m–D–E in A major, in three: a music box playing a lullaby over a
  // piano's left hand and quiet strings, then D–A/C♯–Bm–E. No drums.
  lullaby: {
    bpm: 84,
    bars: 16,
    meter: 3,
    key: 'A major',
    padAttack: 1.2,
    chords: [
      { name: 'A', bass: 45, pad: [57, 61, 64], tones: [45, 57, 61, 64] },
      { name: 'F♯m', bass: 42, pad: [57, 61, 66], tones: [42, 57, 61, 66] },
      { name: 'D', bass: 50, pad: [57, 62, 66], tones: [50, 57, 62, 66] },
      { name: 'E', bass: 52, pad: [56, 59, 64], tones: [52, 56, 59, 64] },
      { name: 'D', bass: 50, pad: [57, 62, 66], tones: [50, 57, 62, 66] },
      { name: 'A/C♯', bass: 49, pad: [57, 61, 64], tones: [49, 57, 61, 64] },
      { name: 'Bm', bass: 47, pad: [59, 62, 66], tones: [47, 54, 59, 62] },
      { name: 'E', bass: 52, pad: [56, 59, 64], tones: [52, 56, 59, 64] },
    ],
    parts: {
      pad: [[0, 6, 0.24]],
      piano: [
        [0, 0, 3, 0.4], [1, 1, 1, 0.22], [1, 2, 1, 0.2], [2, 2, 1, 0.2], [2, 3, 1, 0.18],
        [3, 0, 3, 0.36], [4, 1, 1, 0.2], [4, 3, 1, 0.18], [5, 2, 1, 0.18], [5, 3, 1, 0.16],
      ],
    },
    melody: {
      voice: 'bell',
      notes: [
        [0, 73, 2, 0.62], [2, 76, 1, 0.58], [3, 81, 2, 0.66], [5, 80, 1, 0.56],
        [6, 78, 2, 0.62], [8, 76, 1, 0.56], [9, 73, 3, 0.58],
        [12, 74, 2, 0.6], [14, 78, 1, 0.58], [15, 81, 2, 0.66], [17, 78, 1, 0.56],
        [18, 76, 3, 0.62], [21, 74, 1, 0.54], [22, 73, 1, 0.54], [23, 71, 1, 0.52],
        [24, 78, 2, 0.64], [26, 76, 1, 0.58], [27, 74, 3, 0.6],
        [30, 76, 2, 0.62], [32, 73, 1, 0.56], [33, 69, 3, 0.56],
        [36, 71, 1, 0.54], [37, 73, 1, 0.56], [38, 74, 1, 0.58], [39, 78, 2, 0.64], [41, 76, 1, 0.58],
        [42, 76, 2, 0.6], [44, 68, 1, 0.52], [45, 71, 3, 0.56],
      ],
    },
  },
  // E♭–Cm–A♭–B♭, then A♭–E♭/G–Fm–B♭: a harp rippling up through each chord
  // and a celesta with the tune, over strings. Tender, for a month of
  // children.
  glow: {
    bpm: 72,
    bars: 16,
    key: 'E♭ major',
    padAttack: 1.2,
    chords: [
      { name: 'E♭', bass: 39, pad: [55, 58, 63], tones: [51, 58, 63, 67, 70] },
      { name: 'Cm', bass: 36, pad: [55, 60, 63], tones: [48, 55, 60, 63, 67] },
      { name: 'A♭', bass: 44, pad: [56, 60, 63], tones: [44, 51, 56, 60, 63] },
      { name: 'B♭', bass: 46, pad: [53, 58, 62], tones: [46, 53, 58, 62, 65] },
      { name: 'A♭', bass: 44, pad: [56, 60, 63], tones: [44, 51, 56, 60, 63] },
      { name: 'E♭/G', bass: 43, pad: [55, 58, 63], tones: [43, 51, 55, 58, 63] },
      { name: 'Fm', bass: 41, pad: [56, 60, 65], tones: [41, 48, 53, 56, 60] },
      { name: 'B♭', bass: 46, pad: [53, 58, 62], tones: [46, 53, 58, 62, 65] },
    ],
    parts: {
      pad: [[0, 8, 0.3]],
      string: [
        [0, 0, 3, 0.5], [0.5, 1, 2.5, 0.38], [1, 2, 2, 0.4], [1.5, 3, 2, 0.38],
        [2, 4, 2, 0.42], [2.5, 3, 1.5, 0.34], [3, 2, 1.5, 0.36], [3.5, 1, 1.5, 0.32],
        [4, 0, 3, 0.46], [4.5, 2, 2, 0.36], [5, 3, 2, 0.36], [5.5, 4, 2, 0.34],
        [6, 3, 2, 0.36], [7, 2, 1, 0.3],
      ],
    },
    melody: {
      voice: 'bell',
      notes: [
        [0, 79, 1.5, 0.64], [1.5, 77, 0.5, 0.54], [2, 75, 1, 0.58], [3, 79, 1, 0.6], [4, 82, 3, 0.68],
        [8, 79, 2, 0.62], [10, 75, 1, 0.56], [11, 77, 1, 0.58], [12, 79, 3, 0.62],
        [16, 80, 1.5, 0.64], [17.5, 79, 0.5, 0.56], [18, 77, 1, 0.58], [19, 75, 1, 0.56], [20, 72, 3, 0.58], [23, 75, 1, 0.54],
        [24, 74, 2, 0.6], [26, 77, 2, 0.62], [28, 70, 4, 0.56],
        [32, 72, 1, 0.58], [33, 75, 1, 0.6], [34, 80, 2, 0.66], [36, 79, 1, 0.62], [37, 77, 1, 0.58], [38, 75, 2, 0.6],
        [40, 82, 3, 0.68], [43, 79, 1, 0.6], [44, 75, 4, 0.6],
        [48, 77, 1, 0.6], [49, 79, 1, 0.62], [50, 80, 2, 0.64], [52, 84, 2, 0.7], [54, 80, 2, 0.62],
        [56, 77, 2, 0.6], [58, 74, 2, 0.56], [60, 70, 2, 0.54], [62, 74, 2, 0.56],
      ],
    },
  },
}

const trackOf = (trackId) => TRACKS[trackId] || TRACKS.warm
const meterOf = (track) => track.meter || BEATS_PER_BAR

// The order the tracks take turns in, month by month, with a quiet one never
// next to another quiet one. Eight does not go into twelve, so the same month
// a year later has a different track too: October 2027 does not sound like
// October 2026.
export const TRACK_ORDER = ['warm', 'hope', 'calm', 'folk', 'dusk', 'bright', 'lullaby', 'glow']

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

/** One bar in milliseconds: four beats, or three in the lullaby. */
export function barMs(trackId) {
  const track = trackOf(trackId)
  return meterOf(track) * beatMs(trackId)
}

/**
 * One loop of a track as notes: { bpm, bars, meter, events }, each event
 * { beat, voice, midi, length, velocity, lead }, sorted by beat. midi is null
 * for drums; lead is true for the melody. Pure, so the same track always plays
 * the same notes.
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
  const { voice, notes } = track.melody
  for (const [beat, midi, length, velocity] of notes) events.push({ beat, voice, midi, length, velocity, lead: true })
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
    return chord.pad.map((midi) => ({ beat: offset + beat, voice, midi, length, velocity, lead: false }))
  }
  if (ON_THE_BASS.has(voice)) {
    const [beat, octave, length, velocity] = step
    return [{ beat: offset + beat, voice, midi: chord.bass + 12 * octave, length, velocity, lead: false }]
  }
  if (DRUMS.has(voice)) {
    const [beat, velocity] = step
    return [{ beat: offset + beat, voice, midi: null, length: 0.25, velocity, lead: false }]
  }
  const [beat, tone, length, velocity, octave = 0] = step
  return [{ beat: offset + beat, voice, midi: chord.tones[tone] + 12 * octave, length, velocity, lead: false }]
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
// A slow fade in, so the music arrives under the opening card rather than
// starting on it.
const FADE_IN = 3
const PAUSE_FADE = 0.08
const RESUME_FADE = 0.25

// Longer and a little wetter than a pop mix would have, for the sense of a
// room around slow music; the tail is dark, so it adds space, not haze.
const REVERB_SECONDS = 2.8
const REVERB_WET = 0.3
const NOISE_SECONDS = 1
const STRING_SECONDS = 3

// The peak of one note at full velocity, before the master. The melody is
// written louder than the accompaniment, so the same instrument can play both;
// strings and cello sit under them; the drums are only just there. The pad's
// level is per oscillator, two to a note.
//
// Balanced for a phone, which is where a best-of is mostly watched: its
// speaker plays nothing much below 200 Hz, so a mix that put its weight in
// the bass and the kick — this one did at first, with three quarters of its
// energy under 150 Hz — comes out thin, and loud only where nobody hears it.
const LEVELS = {
  pad: 0.028,
  cello: 0.05,
  piano: 0.18,
  keys: 0.11,
  bass: 0.09,
  string: 0.3,
  bell: 0.14,
  kick: 0.2,
  brush: 0.07,
}

// The melody over the same instrument's accompaniment, some 5 dB up. Measured
// without it, a track lost only 2 dB: the tune was under the chords, not on
// top of them.
const LEAD = 1.8

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
      midi: event.midi,
      f: event.midi == null ? 0 : 440 * 2 ** ((event.midi - 69) / 12),
      velocity: event.velocity,
      peak: LEVELS[event.voice] * event.velocity * (event.lead ? LEAD : 1),
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

// A slow vibrato on the given oscillators, which a bowed string only finds
// once the note has settled: none at the start, the full width after `onset`.
// Each note gets its own, at a rate of its own, so a chord shimmers the way a
// section of players does rather than wobbling as one.
function vibrato(ctx, targets, at, { rate, cents, onset }) {
  const lfo = oscillator(ctx, 'sine', rate)
  const depth = gainNode(ctx, 0)
  depth.gain.setValueAtTime(0, at)
  depth.gain.linearRampToValueAtTime(cents, at + onset)
  lfo.connect(depth)
  for (const target of targets) depth.connect(target.detune)
  return { lfo, depth }
}

const VOICES = {
  // A string section: two sawtooths a few cents apart, each note with its own
  // vibrato, swelling in slowly and dying away slowly, under a dark lowpass.
  // The sawtooth is what a bow does to a string; the vibrato, the slow swell
  // and the lowpass are what stop it sounding like a synthesiser.
  pad(ctx, out, { at, end, f, peak, attack, midi }) {
    const amp = gainNode(ctx, 0)
    const saws = [-6, 6].map((cents) => {
      const saw = oscillator(ctx, 'sawtooth', f)
      saw.detune.value = cents
      saw.connect(amp)
      return saw
    })
    const { lfo, depth } = vibrato(ctx, saws, at, { rate: 4.6 + (midi % 5) * 0.17, cents: 7, onset: attack })
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack, decay: 1, sustain: 1, end, release: 1 })
    return run([...saws, lfo], [...saws, lfo, depth, amp], at, stopAt)
  },

  // A cello, bowed under the chord: a sawtooth and a triangle an octave
  // apart for body, a wider vibrato than the section's, and a bow that takes
  // a moment to bite.
  cello(ctx, out, { at, end, f, peak }) {
    const amp = gainNode(ctx, 0)
    const bow = oscillator(ctx, 'sawtooth', f)
    const body = oscillator(ctx, 'triangle', f * 2)
    const bodyAmp = gainNode(ctx, 0.5)
    bow.connect(amp)
    body.connect(bodyAmp)
    bodyAmp.connect(amp)
    const { lfo, depth } = vibrato(ctx, [bow, body], at, { rate: 5.2, cents: 12, onset: 0.8 })
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.35, decay: 2, sustain: 0.8, end, release: 0.8 })
    return run([bow, body, lfo], [bow, body, bodyAmp, lfo, depth, amp], at, stopAt)
  },

  // A piano. Its strings come in pairs tuned a hair apart, which is where a
  // piano's warmth comes from, so the note is two oscillators of a soft tone
  // (chain.waves.piano) a cent or so either side of the pitch. The hammer's
  // brightness is a third, of a tone rich in overtones (chain.waves.hammer),
  // louder the harder the key is struck and gone within a fraction of a
  // second. The note then fades as a piano's does, whether the key is held or
  // not — low notes slower than high ones — until the damper takes it.
  piano(ctx, out, { at, end, f, peak, velocity }, chain) {
    const amp = gainNode(ctx, 0)
    const pair = [-1.2, 1.2].map((cents) => {
      const string = ctx.createOscillator()
      string.setPeriodicWave(chain.waves.piano)
      string.frequency.value = f
      string.detune.value = cents
      string.connect(amp)
      return string
    })
    const hammer = ctx.createOscillator()
    hammer.setPeriodicWave(chain.waves.hammer)
    hammer.frequency.value = f
    const hammerAmp = gainNode(ctx, 0)
    hammer.connect(hammerAmp)
    hammerAmp.connect(out)
    amp.connect(out)
    const ring = Math.min(6, Math.max(1.2, 3.5 * Math.sqrt(220 / f)))
    envelope(hammerAmp.gain, at, {
      peak: peak * (0.2 + 0.6 * velocity), attack: 0.004, decay: 0.12 * Math.sqrt(220 / f) + 0.05, sustain: 0, end: at, release: 0.05,
    })
    const stopAt = envelope(amp.gain, at, { peak: peak * 0.5, attack: 0.006, decay: ring / 3, sustain: 0.04, end, release: 0.3 })
    return run([...pair, hammer], [...pair, hammer, hammerAmp, amp], at, stopAt)
  },

  // An electric piano from two sines. The modulator bends the carrier's
  // waveform, brightly at the strike and less and less after, the way a tine
  // sounds. It is a cosine because a sine at the carrier's own pitch would add
  // a DC offset that rises and falls with every note. Struck gently: harder,
  // it turns from mellow to glassy, and glassy is not what it is here for.
  keys(ctx, out, { at, end, f, peak, velocity }, chain) {
    const carrier = oscillator(ctx, 'sine', f)
    const modulator = ctx.createOscillator()
    modulator.setPeriodicWave(chain.waves.cosine)
    modulator.frequency.value = f
    const depth = gainNode(ctx, 0)
    depth.gain.setValueAtTime(f * (0.2 + 0.7 * velocity), at)
    depth.gain.setTargetAtTime(f * 0.04, at, 0.4)
    const amp = gainNode(ctx, 0)
    modulator.connect(depth)
    depth.connect(carrier.frequency)
    carrier.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.008, decay: 1.6, sustain: 0.3, end, release: 0.35 })
    return run([carrier, modulator], [carrier, modulator, depth, amp], at, stopAt)
  },

  // A round bass, plucked rather than held: a triangle for overtones a phone
  // speaker can play and a sine at the same pitch for roundness. The sine
  // doubles the fundamental rather than sitting an octave under it: an octave
  // under D2 is 37 Hz, which a phone cannot play and which would only push
  // the compressor.
  bass(ctx, out, { at, end, f, peak }) {
    const amp = gainNode(ctx, 0)
    const body = oscillator(ctx, 'triangle', f)
    const sub = oscillator(ctx, 'sine', f)
    body.connect(amp)
    sub.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.015, decay: 0.7, sustain: 0.4, end, release: 0.12 })
    return run([body, sub], [body, sub, amp], at, stopAt)
  },

  // A plucked string, Karplus–Strong: a burst of noise going round a loop one
  // period long, softened a little each time round, as a string loses its
  // overtones first. A guitar low down, a harp higher up. It is worked out
  // once per pitch, ahead of time (stringBuffer), since a feedback loop of Web
  // Audio nodes cannot be shorter than 128 samples and so could not play
  // anything above E4.
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
      envelope(amp.gain, at, { peak, attack: 0.003, decay: 2, sustain: 1, end: end + 0.6, release: 0.35 }),
    )
    return run([source], [source, amp], at, stopAt)
  },

  // A music box or a celesta: a small tuned bar, struck softly. Its tone is
  // almost a sine, with the octave and a faint inharmonic partial above
  // that die away first and give it its shimmer, and it rings on for a while.
  bell(ctx, out, { at, f, peak }) {
    const sources = []
    const nodes = []
    let stopAt = at
    for (const [ratio, level, decay] of [[1, 1, 1.1], [2, 0.22, 0.45], [4.2, 0.06, 0.12]]) {
      const tone = oscillator(ctx, 'sine', f * ratio)
      const amp = gainNode(ctx, 0)
      tone.connect(amp)
      amp.connect(out)
      const end = envelope(amp.gain, at, { peak: peak * level, attack: 0.003, decay, sustain: 0, end: at, release: decay })
      stopAt = Math.max(stopAt, end)
      sources.push(tone)
      nodes.push(tone, amp)
    }
    return run(sources, nodes, at, stopAt)
  },

  // A kick drum muffled with felt, a heartbeat more than a beat: a sine
  // dropping from 90 to 48 Hz, with no click on top.
  kick(ctx, out, { at, peak }) {
    const body = oscillator(ctx, 'sine', 90)
    body.frequency.setValueAtTime(90, at)
    body.frequency.exponentialRampToValueAtTime(48, at + 0.18)
    const amp = gainNode(ctx, 0)
    body.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.008, decay: 0.15, sustain: 0, end: at, release: 0.15 })
    return run([body], [body, amp], at, stopAt)
  },

  // A brush on a snare: a short swish of noise that comes in rather than
  // cracks, through a band that keeps it soft.
  brush(ctx, out, { at, peak, offset }, chain) {
    const noise = ctx.createBufferSource()
    noise.buffer = chain.noise
    const amp = gainNode(ctx, 0)
    noise.connect(amp)
    amp.connect(out)
    const stopAt = envelope(amp.gain, at, { peak, attack: 0.025, decay: 0.07, sustain: 0, end: at, release: 0.08 })
    noise.start(at, offset)
    noise.stop(stopAt)
    return { sources: [noise], nodes: [noise, amp] }
  },
}

// A periodic wave from the levels of its harmonics, the first being the
// fundamental.
function harmonics(ctx, levels) {
  const imag = new Float32Array([0, ...levels])
  return ctx.createPeriodicWave(new Float32Array(imag.length), imag)
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
  const padFilter = filter(ctx, 'lowpass', 1300)
  const inputs = {
    pad: input(padFilter),
    cello: input(filter(ctx, 'lowpass', 900)),
    piano: input(filter(ctx, 'lowpass', 4200)),
    keys: input(filter(ctx, 'lowpass', 2400)),
    // High enough to let the triangle's overtones through: on a phone they
    // are the bass line, its fundamentals being too low to play.
    bass: input(filter(ctx, 'lowpass', 650)),
    string: input(filter(ctx, 'lowpass', 3000)),
    bell: input(filter(ctx, 'lowpass', 5000)),
    kick: bus,
    brush: input(filter(ctx, 'highpass', 2500), filter(ctx, 'lowpass', 6500)),
  }

  // The strings' lowpass drifts slowly up and down, so a held chord breathes
  // instead of standing still.
  const drift = keep(oscillator(ctx, 'sine', 0.07))
  const driftDepth = keep(gainNode(ctx, 250))
  drift.connect(driftDepth)
  driftDepth.connect(padFilter.frequency)
  drift.start()

  const waves = {
    cosine: ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0])),
    // The body of a piano note once the hammer's brightness has gone: mostly
    // the fundamental, a little of the next few harmonics.
    piano: harmonics(ctx, [1, 0.42, 0.18, 0.1, 0.05, 0.03]),
    // The hammer's strike: the harmonics falling off slowly, for a moment.
    hammer: harmonics(ctx, [0.5, 0.6, 0.5, 0.4, 0.3, 0.24, 0.18, 0.12, 0.08, 0.05]),
  }
  return { master, inputs, nodes, drift, noise, waves }
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
// every time it is struck. It is smoothed before it goes round, as a
// fingertip rather than a pick would excite the string: a warmer, rounder
// pluck.
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
    smoothed += 0.3 * ((seed / 2 ** 32) * 2 - 1 - smoothed)
    data[i] = smoothed * 1.6
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

// A room, faked: noise that dies away by 60 dB over a few seconds, different
// in each ear so it sounds wide. It is smoothed more and more as it decays,
// since a real room swallows the highs first, and a bright tail is what makes
// cheap reverb sound cheap.
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
