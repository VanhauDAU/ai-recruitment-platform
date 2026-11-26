import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHideOnScroll } from './use-hide-on-scroll'

function scrollTo(y) {
  act(() => {
    window.scrollY = y
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('useHideOnScroll', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback) => callback())
    window.scrollY = 0
  })
  afterEach(() => vi.unstubAllGlobals())

  it('hides when scrolling down and shows again when scrolling up', () => {
    const { result } = renderHook(() => useHideOnScroll())
    scrollTo(400)
    expect(result.current).toBe(false)
    scrollTo(300)
    expect(result.current).toBe(true)
  })

  it('with topOnly stays hidden mid-page and shows only near the top', () => {
    const { result } = renderHook(() => useHideOnScroll(96, { topOnly: true }))
    scrollTo(400)
    scrollTo(300)
    expect(result.current).toBe(false)
    scrollTo(40)
    expect(result.current).toBe(true)
  })
})
