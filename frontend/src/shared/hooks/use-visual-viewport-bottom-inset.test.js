import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisualViewportBottomInset } from './use-visual-viewport-bottom-inset'

describe('useVisualViewportBottomInset', () => {
  let animationFrameCallback
  let innerHeightDescriptor
  let visualViewportDescriptor
  let visualViewport

  beforeEach(() => {
    innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    visualViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    visualViewport = new EventTarget()
    visualViewport.height = 1000
    visualViewport.offsetTop = 0
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallback = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (innerHeightDescriptor) Object.defineProperty(window, 'innerHeight', innerHeightDescriptor)
    else delete window.innerHeight
    if (visualViewportDescriptor) Object.defineProperty(window, 'visualViewport', visualViewportDescriptor)
    else delete window.visualViewport
  })

  it('bù phần đáy bị visual viewport che khi thanh trình duyệt hiện lại', () => {
    const { result } = renderHook(() => useVisualViewportBottomInset())
    expect(result.current).toBe(0)

    act(() => animationFrameCallback(0))
    visualViewport.height = 820
    visualViewport.offsetTop = 24
    act(() => {
      visualViewport.dispatchEvent(new Event('resize'))
      animationFrameCallback(16)
    })

    expect(result.current).toBe(156)
  })

  it('không tạo inset âm khi visual viewport chạm đáy layout viewport', () => {
    visualViewport.height = 980
    visualViewport.offsetTop = 40

    const { result } = renderHook(() => useVisualViewportBottomInset())

    expect(result.current).toBe(0)
  })
})
