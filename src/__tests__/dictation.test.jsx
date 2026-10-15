/**
 * Dictation: the text helper, the hook around the browser's speech
 * recognition, and the field wrapper. The recognition itself is faked — jsdom
 * has none — so these cover our wiring, not the browser's accuracy.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DictationField from '../components/DictationField'
import { appendDictation } from '../hooks/useDictation'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

let instances = []
class FakeRecognition {
  constructor() {
    instances.push(this)
  }
  start() { this.started = true }
  stop() { this.onend?.() }
  abort() {}
}

function say(recognition, transcript) {
  act(() => {
    recognition.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript }], { isFinal: true })],
    })
  })
}

function Harness({ max }) {
  const [value, setValue] = useState('Hallo')
  return (
    <DictationField onText={(s) => setValue((v) => appendDictation(v, s, max))}>
      <textarea aria-label="field" value={value} onChange={(e) => setValue(e.target.value)} />
    </DictationField>
  )
}

afterEach(() => {
  cleanup()
  instances = []
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
})

describe('appendDictation', () => {
  it('joins with a single space and ignores empty speech', () => {
    expect(appendDictation('Hallo', ' Welt ')).toBe('Hallo Welt')
    expect(appendDictation('', 'Welt')).toBe('Welt')
    expect(appendDictation('Hallo ', 'Welt')).toBe('Hallo Welt')
    expect(appendDictation('Hallo', '  ')).toBe('Hallo')
  })

  it('respects a maximum length', () => {
    expect(appendDictation('abc', 'defgh', 6)).toBe('abc de')
  })
})

describe('DictationField', () => {
  it('renders just the field where speech recognition is missing', () => {
    render(<Harness />)
    expect(screen.getByLabelText('field')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('appends finished phrases to the field and shows the privacy notice while listening', async () => {
    window.webkitSpeechRecognition = FakeRecognition
    render(<Harness />)
    await userEvent.click(await screen.findByRole('button', { name: 'dictation.start' }))

    expect(instances).toHaveLength(1)
    expect(instances[0].started).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('dictation.notice')

    say(instances[0], 'schöne Welt')
    expect(screen.getByLabelText('field').value).toBe('Hallo schöne Welt')

    await userEvent.click(screen.getByRole('button', { name: 'dictation.stop' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('reports a denied microphone', async () => {
    window.SpeechRecognition = FakeRecognition
    render(<Harness />)
    await userEvent.click(await screen.findByRole('button', { name: 'dictation.start' }))
    act(() => instances[0].onerror({ error: 'not-allowed' }))
    expect(screen.getByRole('alert').textContent).toBe('dictation.error.denied')
  })
})
