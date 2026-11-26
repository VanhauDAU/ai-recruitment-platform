import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdKeyboardFocus } from './hold-keyboard-focus'

describe('holdKeyboardFocus', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('focuses a hidden input until the real field takes focus', () => {
    const real = document.createElement('input')
    document.body.appendChild(real)

    holdKeyboardFocus()
    const holder = document.activeElement
    expect(holder).not.toBe(real)
    expect(holder).toHaveAttribute('aria-hidden', 'true')

    real.focus()
    expect(document.activeElement).toBe(real)
    expect(holder.isConnected).toBe(false)
  })

  it('removes the hidden input when the real field never appears', () => {
    vi.useFakeTimers()
    holdKeyboardFocus(500)
    const holder = document.activeElement

    vi.advanceTimersByTime(500)
    expect(holder.isConnected).toBe(false)
  })
})
