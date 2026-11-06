import { describe, it, expect } from 'vitest'
import { editorReducer, initialState } from '../components/scrapbook/editorState'

const photo = { id: 'p1', type: 'photo', url: 'a.enc', x: 0, y: 0, width: 100, height: 100 }
const start = () => ({
  ...initialState,
  pages: [{ id: 'page', backgroundColor: '#fff', backgroundPattern: 'none', elements: [photo], customizable: true }],
})
const update = (state, updates, gesture) => editorReducer(state, { type: 'UPDATE_ELEMENT', id: 'p1', updates, gesture })
const el = (state) => state.pages[0].elements[0]

describe('editorReducer undo history', () => {
  it('records a whole drag as one undo step', () => {
    let state = start()
    for (let w = 110; w <= 200; w += 10) state = update(state, { width: w }, 'drag-1')
    expect(state.history).toHaveLength(1)
    state = editorReducer(state, { type: 'UNDO' })
    expect(el(state).width).toBe(100)
  })

  it('keeps separate gestures and plain updates as separate steps', () => {
    let state = start()
    state = update(state, { width: 150 }, 'drag-1')
    state = update(state, { width: 160 }, 'drag-1')
    state = update(state, { rotation: 10 }, 'rotate-1')
    state = update(state, { polaroid: true })
    state = update(state, { caption: 'x' }, 'caption:p1')
    expect(state.history).toHaveLength(4)
    state = editorReducer(state, { type: 'UNDO' })
    expect(el(state).polaroid).toBe(true)
    expect(el(state).caption).toBeUndefined()
  })

  it('starts a new step for the same gesture key after an undo', () => {
    let state = start()
    state = update(state, { caption: 'a' }, 'caption:p1')
    state = editorReducer(state, { type: 'UNDO' })
    state = update(state, { caption: 'b' }, 'caption:p1')
    expect(state.history).toHaveLength(1)
  })

  it('carries a photo\'s framing along when two photos swap', () => {
    const other = { ...photo, id: 'p2', url: 'b.enc', offsetY: -1, fit: 'contain' }
    let state = start()
    state = { ...state, pages: [{ ...state.pages[0], elements: [photo, other] }] }
    state = editorReducer(state, { type: 'SWAP_PHOTOS', idA: 'p1', idB: 'p2' })
    expect(state.pages[0].elements[0]).toMatchObject({ url: 'b.enc', offsetY: -1, fit: 'contain' })
    expect(state.pages[0].elements[1]).toMatchObject({ url: 'a.enc', offsetY: 0, fit: null })
  })
})

describe('editorReducer MARK_SAVED', () => {
  // A write that comes back after a newer edit must not mark that edit as
  // saved: the debounced save for it would be cancelled and the edit lost.
  it('marks the editor clean when what was written is still what is shown', () => {
    const state = editorReducer(start(), { type: 'SET_TITLE', title: 'A' })
    const saved = editorReducer(state, { type: 'MARK_SAVED', pages: state.pages, title: 'A' })
    expect(saved.isDirty).toBe(false)
  })

  it('keeps an edit made while the write was on its way unsaved', () => {
    const atWrite = editorReducer(start(), { type: 'SET_TITLE', title: 'A' })
    const later = editorReducer(atWrite, { type: 'SET_TITLE', title: 'B' })
    expect(editorReducer(later, { type: 'MARK_SAVED', pages: atWrite.pages, title: 'A' }).isDirty).toBe(true)

    const moved = update(atWrite, { width: 150 })
    expect(editorReducer(moved, { type: 'MARK_SAVED', pages: atWrite.pages, title: 'A' }).isDirty).toBe(true)
  })
})
