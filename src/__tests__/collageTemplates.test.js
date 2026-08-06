import { describe, it, expect } from 'vitest'
import {
  COLLAGE_TEMPLATES,
  ASPECTS,
  applyTemplate,
  fillTemplate,
  getTemplate,
  makeCollageDoc,
  templateSize,
} from '../components/collage/collageTemplates'
import { DECORATION_PAINTERS } from '../components/collage/collageDecorations'
import en from '../locales/en/collage.json'
import de from '../locales/de/collage.json'

const lookup = (bundle, path) => path.split('.').reduce((node, key) => node?.[key], bundle)

describe('collage templates', () => {
  it('gives every template a unique id', () => {
    const ids = COLLAGE_TEMPLATES.map((tpl) => tpl.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every slot inside the canvas', () => {
    for (const tpl of COLLAGE_TEMPLATES) {
      expect(tpl.slots.length, `${tpl.id} has no slots`).toBeGreaterThan(0)
      for (const slot of tpl.slots) {
        expect(slot.x, `${tpl.id}/${slot.id} x`).toBeGreaterThanOrEqual(0)
        expect(slot.y, `${tpl.id}/${slot.id} y`).toBeGreaterThanOrEqual(0)
        expect(slot.x + slot.w, `${tpl.id}/${slot.id} right edge`).toBeLessThanOrEqual(1.0001)
        expect(slot.y + slot.h, `${tpl.id}/${slot.id} bottom edge`).toBeLessThanOrEqual(1.0001)
      }
      const slotIds = tpl.slots.map((s) => s.id)
      expect(new Set(slotIds).size, `${tpl.id} slot ids`).toBe(slotIds.length)
      expect(ASPECTS[tpl.aspect], `${tpl.id} aspect`).toBeDefined()
    }
  })

  it('has an English and a German label for every template', () => {
    for (const tpl of COLLAGE_TEMPLATES) {
      expect(lookup(en, tpl.labelKey), `${tpl.id} EN`).toBeTruthy()
      expect(lookup(de, tpl.labelKey), `${tpl.id} DE`).toBeTruthy()
    }
  })

  it('falls back to the first template for an unknown id', () => {
    expect(getTemplate('does-not-exist')).toBe(COLLAGE_TEMPLATES[0])
    expect(getTemplate()).toBe(COLLAGE_TEMPLATES[0])
  })

  it('derives pixel size from the aspect ratio', () => {
    const square = COLLAGE_TEMPLATES.find((tpl) => tpl.aspect === '1:1')
    expect(templateSize(square, 800)).toEqual({ width: 800, height: 800 })

    const portrait = COLLAGE_TEMPLATES.find((tpl) => tpl.aspect === '4:5')
    expect(templateSize(portrait, 800)).toEqual({ width: 800, height: 1000 })
  })

  it('gives every decoration a painter that exists', () => {
    for (const tpl of COLLAGE_TEMPLATES) {
      for (const decoration of tpl.decorations || []) {
        expect(DECORATION_PAINTERS[decoration.type], `${tpl.id}/${decoration.type}`).toBeTypeOf('function')
      }
    }
  })

  it('offers real variety rather than the same shape twelve times', () => {
    const decorated = COLLAGE_TEMPLATES.filter((tpl) => (tpl.decorations || []).length > 0)
    expect(decorated.length).toBeGreaterThanOrEqual(8)

    const gradients = COLLAGE_TEMPLATES.filter((tpl) => typeof tpl.background === 'object')
    expect(gradients.length).toBeGreaterThanOrEqual(6)

    const multiPhoto = COLLAGE_TEMPLATES.filter((tpl) => tpl.slots.length > 1)
    expect(multiPhoto.length).toBeGreaterThanOrEqual(5)

    const shapes = new Set(COLLAGE_TEMPLATES.flatMap((tpl) => tpl.slots.map((s) => s.shape)))
    expect(shapes.size).toBeGreaterThanOrEqual(3)
  })

  it('starts a new collage with one empty slot per template slot', () => {
    const tpl = getTemplate('mint-four')
    const doc = makeCollageDoc(tpl)
    expect(doc.templateId).toBe('mint-four')
    expect(doc.slots).toHaveLength(4)
    expect(doc.slots.every((s) => s.url === null)).toBe(true)
    // Null, not a copy of the template colour: a restyled template must reach
    // collages whose background the customer never touched.
    expect(doc.background).toBeNull()
  })

  it('repeats photos when a preview has fewer than the template needs', () => {
    const doc = fillTemplate(getTemplate('mint-four'), ['a.jpg', 'b.jpg'])
    expect(doc.slots.map((s) => s.url)).toEqual(['a.jpg', 'b.jpg', 'a.jpg', 'b.jpg'])
  })

  describe('switching template', () => {
    const filled = () => ({
      ...makeCollageDoc(getTemplate('mint-four')),
      slots: makeCollageDoc(getTemplate('mint-four')).slots.map((slot, i) => (
        i < 3 ? { ...slot, url: `photo-${i}.jpg`, imageScale: 1.5 } : slot
      )),
    })

    it('carries the placed photos onto the new slots in order', () => {
      const next = applyTemplate(filled(), getTemplate('night-six'))
      expect(next.templateId).toBe('night-six')
      expect(next.slots).toHaveLength(6)
      expect(next.slots.slice(0, 3).map((s) => s.url)).toEqual([
        'photo-0.jpg', 'photo-1.jpg', 'photo-2.jpg',
      ])
      expect(next.slots.slice(3).every((s) => s.url === null)).toBe(true)
      // Per-photo crop settings travel with the photo.
      expect(next.slots[0].imageScale).toBe(1.5)
    })

    it('drops nothing but the overflow when the new template is smaller', () => {
      const next = applyTemplate(filled(), getTemplate('daisy-field'))
      expect(next.slots).toHaveLength(1)
      expect(next.slots[0].url).toBe('photo-0.jpg')
    })

    it('keeps a background the user chose, and lets the new template show otherwise', () => {
      const chosen = { ...filled(), background: '#123456' }
      expect(applyTemplate(chosen, getTemplate('night-six')).background).toBe('#123456')

      // Untouched stays null, so the new template's own artwork comes through.
      expect(applyTemplate(filled(), getTemplate('film-strip')).background).toBeNull()
    })

    it('keeps the border styling across the switch', () => {
      const styled = { ...filled(), border: { color: '#FFFFFF', width: 0.02, radius: 0.2, gap: 0.03 } }
      expect(applyTemplate(styled, getTemplate('night-six')).border).toEqual(styled.border)
    })
  })
})
