/* The crop dialog of the moment post dialog. Moving the focus point once threw
   away the zoom, and the zoom label then crashed the app. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))
vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))

import FocusPicker from '../components/admin/FocusPicker'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FocusPicker', () => {
  it('keeps the zoom when the focus point moves, and saves both', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100,
    })
    const onSave = vi.fn()
    render(<FocusPicker item={{ id: 'a', preview: 'blob:a', focus: '' }} onSave={onSave} onClose={() => {}} />)

    fireEvent.change(document.querySelector('input[type=range]'), { target: { value: '2' } })
    fireEvent.pointerDown(screen.getByLabelText('focus.title'), { clientX: 40, clientY: 25 })
    expect(screen.getByText('2.0×')).toBeTruthy()

    fireEvent.keyDown(screen.getByLabelText('focus.title'), { key: 'ArrowRight' })
    fireEvent.click(screen.getByText('focus.done'))
    expect(onSave).toHaveBeenCalledWith('25 25 2')
  })
})
