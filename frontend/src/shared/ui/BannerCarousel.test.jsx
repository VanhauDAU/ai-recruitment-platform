import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BannerCarousel from './BannerCarousel'

const slides = ['Một', 'Hai', 'Ba'].map((label) => <button key={label} type="button">{label}</button>)

function visibleSlide() {
  return screen.getAllByRole('group', { hidden: true }).findIndex((node) => node.getAttribute('aria-hidden') === 'false')
}

describe('BannerCarousel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('auto-advances and pauses while focus is inside', () => {
    render(<BannerCarousel slides={slides} />)
    act(() => vi.advanceTimersByTime(5000))
    expect(visibleSlide()).toBe(1)

    fireEvent.focus(screen.getByRole('button', { name: 'Banner tiếp theo' }))
    act(() => vi.advanceTimersByTime(15000))
    expect(visibleSlide()).toBe(1)
  })

  it('does not auto-advance when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    render(<BannerCarousel slides={slides} />)
    act(() => vi.advanceTimersByTime(15000))
    expect(visibleSlide()).toBe(0)
  })

  it('moves with swipe gestures and the dot buttons', () => {
    render(<BannerCarousel slides={slides} />)
    const carousel = screen.getByRole('region', { name: 'Banner nổi bật' })
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] })
    expect(visibleSlide()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển đến banner 3' }))
    expect(visibleSlide()).toBe(2)
  })
})
