import { describe, it, expect } from 'vitest'
import { snapToCenter } from '../components/scrapbook/centerSnap'

const el = { width: 200, height: 100 }

describe('snapToCenter', () => {
  it('pulls an element near the middle onto it and reports both lines', () => {
    // Centred would be x 300, y 250.
    expect(snapToCenter(el, 303, 247, 800, 600)).toEqual({
      x: 300, y: 250, guides: { vertical: true, horizontal: true },
    })
  })

  it('snaps one axis only when the other is far off', () => {
    expect(snapToCenter(el, 298, 40, 800, 600)).toEqual({
      x: 300, y: 40, guides: { vertical: true, horizontal: false },
    })
  })

  it('leaves an element alone beyond the snap distance', () => {
    expect(snapToCenter(el, 320, 100, 800, 600)).toEqual({
      x: 320, y: 100, guides: { vertical: false, horizontal: false },
    })
  })
})
