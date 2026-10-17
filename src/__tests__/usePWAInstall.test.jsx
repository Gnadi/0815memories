/* The browser fires beforeinstallprompt once, early. Each hook used to listen
   for itself, so the settings page — lazily loaded, mounted long after — never
   heard it and could not offer to install. The event is now captured once. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

let usePWAInstall

function promptEvent(outcome = 'accepted') {
  const e = new Event('beforeinstallprompt')
  e.prompt = vi.fn()
  e.userChoice = Promise.resolve({ outcome })
  return e
}

beforeEach(async () => {
  vi.resetModules()
  ;({ default: usePWAInstall } = await import('../hooks/usePWAInstall'))
})

describe('usePWAInstall', () => {
  it('offers a prompt that fired before the hook mounted', () => {
    act(() => { window.dispatchEvent(promptEvent()) })
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.canInstall).toBe(true)
  })

  it('shares one prompt between every component, and shows it once', async () => {
    const event = promptEvent()
    act(() => { window.dispatchEvent(event) })
    const banner = renderHook(() => usePWAInstall())
    const settings = renderHook(() => usePWAInstall())

    let accepted
    await act(async () => { accepted = await settings.result.current.promptInstall() })

    expect(accepted).toBe(true)
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(banner.result.current.canInstall).toBe(false)
    expect(settings.result.current.canInstall).toBe(false)
  })

  it('stops offering once the app is installed', () => {
    act(() => { window.dispatchEvent(promptEvent()) })
    const { result } = renderHook(() => usePWAInstall())
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(result.current.canInstall).toBe(false)
    expect(result.current.installed).toBe(true)
  })
})
