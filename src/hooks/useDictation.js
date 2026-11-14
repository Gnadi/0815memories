import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import i18n from 'i18next'

// Dictation uses the browser's own speech recognition. Chrome and Safari send
// the audio to the browser vendor's servers for it, which is why the UI says
// so while the microphone is open (see the `dictation` strings in `common`).
// The constructor is looked up lazily: public routes are pre-rendered in Node,
// where `window` does not exist.
function getRecognitionClass() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

const subscribeNever = () => () => {}

const RECOGNITION_LANGUAGES = { de: 'de-DE', en: 'en-US' }

/**
 * Append dictated text to what is already in a field, with a space between
 * them, cut to `max` characters when the field has a limit.
 */
export function appendDictation(current, spoken, max) {
  const base = current ?? ''
  const text = (spoken ?? '').trim()
  if (!text) return base
  const joined = base && !/\s$/.test(base) ? `${base} ${text}` : `${base}${text}`
  return max ? joined.slice(0, max) : joined
}

/**
 * Speech-to-text for a text field. `onText` is called with each finished
 * phrase; it is not called with interim guesses, so the field never has to
 * take a phrase back.
 *
 * @returns {{ supported: boolean, listening: boolean, error: string|null,
 *             toggle: () => void, stop: () => void }}
 *   `error` is 'denied', 'unavailable' or null.
 */
export default function useDictation(onText) {
  // False on the server and during hydration, so a pre-rendered page matches.
  const supported = useSyncExternalStore(
    subscribeNever,
    () => Boolean(getRecognitionClass()),
    () => false,
  )
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const onTextRef = useRef(onText)

  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  useEffect(() => {
    // Closing the form mid-dictation must not leave the microphone on.
    return () => recognitionRef.current?.abort()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Recognition = getRecognitionClass()
    if (!Recognition) return
    setError(null)
    const recognition = new Recognition()
    recognition.lang = RECOGNITION_LANGUAGES[(i18n.language || 'en').slice(0, 2)] || 'en-US'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      let spoken = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) spoken += event.results[i][0].transcript
      }
      if (spoken.trim()) onTextRef.current?.(spoken)
    }
    recognition.onerror = (event) => {
      // Silence is not a failure worth showing.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'denied'
        : 'unavailable')
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setListening(false)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      setError('unavailable')
    }
  }, [])

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop()
    else start()
  }, [start, stop])

  return { supported, listening, error, toggle, stop }
}
