// State of the scrapbook editor: the pages, the selection and the undo history.

const MAX_HISTORY = 20

export function makeBlankPage() {
  return {
    id: crypto.randomUUID(),
    backgroundColor: '#FDF6EC',
    backgroundPattern: 'none',
    elements: [],
    customizable: false,
  }
}

// How a photo is framed travels with the photo: a swap moves it along, and a
// new picture in the same frame starts from the plain centred crop.
const cropOf = (el) => ({
  imageScale: el.imageScale || 1,
  flipped: !!el.flipped,
  offsetX: el.offsetX || 0,
  offsetY: el.offsetY || 0,
  fit: el.fit || null,
})
export const FRESH_CROP = { imageScale: 1, offsetX: 0, offsetY: 0, fit: null }

export function editorReducer(state, action) {
  const { pages, currentPageIndex } = state

  // `gesture` groups a run of updates into one undo step: every pointer move of
  // a resize, rotation or pan, or every tick of a slider, carries the same key,
  // and only the first of them records the page as it was before. Without it a
  // single drag filled the whole history, and undo could not get back past it.
  const withHistory = (newPages, gesture = null) => {
    if (gesture && state.gesture === gesture) {
      return { ...state, pages: newPages, isDirty: true }
    }
    const history = [pages, ...state.history].slice(0, MAX_HISTORY)
    return { ...state, pages: newPages, history, isDirty: true, gesture }
  }

  const updateCurrentPage = (updater, gesture) => {
    const newPages = pages.map((p, i) => i === currentPageIndex ? updater(p) : p)
    return withHistory(newPages, gesture)
  }

  switch (action.type) {
    case 'LOAD':
      return { ...state, pages: action.pages, title: action.title ?? state.title, isDirty: false, history: [] }

    case 'SET_TITLE':
      return { ...state, title: action.title, isDirty: true }

    case 'SWITCH_PAGE':
      return { ...state, currentPageIndex: action.index, selectedId: null }

    case 'ADD_PAGE':
      return { ...withHistory([...pages, makeBlankPage()]), currentPageIndex: pages.length, selectedId: null }

    case 'DELETE_PAGE': {
      if (pages.length <= 1) return state
      const newPages = pages.filter((_, i) => i !== action.index)
      const newIndex = Math.min(currentPageIndex, newPages.length - 1)
      return { ...withHistory(newPages), currentPageIndex: newIndex, selectedId: null }
    }

    case 'ADD_ELEMENT':
      return updateCurrentPage((p) => ({
        ...p,
        elements: [...p.elements, { id: crypto.randomUUID(), ...action.element }],
      }))

    case 'UPDATE_ELEMENT':
      return updateCurrentPage((p) => ({
        ...p,
        elements: p.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.updates } : el
        ),
      }), action.gesture)

    case 'DELETE_ELEMENT':
      return updateCurrentPage((p) => ({
        ...p,
        elements: p.elements.filter((el) => el.id !== action.id),
      }))

    case 'SWAP_PHOTOS': {
      const { idA, idB } = action
      return updateCurrentPage((p) => {
        const a = p.elements.find((e) => e.id === idA)
        const b = p.elements.find((e) => e.id === idB)
        if (!a || !b) return p
        return {
          ...p,
          elements: p.elements.map((el) => {
            if (el.id === idA) return { ...el, url: b.url, isSlot: !b.url, ...cropOf(b) }
            if (el.id === idB) return { ...el, url: a.url, isSlot: !a.url, ...cropOf(a) }
            return el
          }),
        }
      })
    }

    case 'APPLY_LAYOUT':
      return updateCurrentPage((p) => ({ ...p, elements: action.elements }))

    case 'CHANGE_BACKGROUND':
      return updateCurrentPage((p) => ({ ...p, ...action.updates }))

    case 'TOGGLE_CUSTOMIZE':
      return updateCurrentPage((p) => ({ ...p, customizable: !p.customizable }))

    case 'SELECT':
      return { ...state, selectedId: action.id, gesture: null }

    case 'UNDO': {
      if (state.history.length === 0) return state
      const [prev, ...rest] = state.history
      return { ...state, pages: prev, history: rest, isDirty: true, gesture: null }
    }

    case 'MARK_SAVED':
      return { ...state, isDirty: false }

    default:
      return state
  }
}

export const initialState = {
  pages: [makeBlankPage()],
  currentPageIndex: 0,
  selectedId: null,
  history: [],
  isDirty: false,
  title: 'My Scrapbook',
}
