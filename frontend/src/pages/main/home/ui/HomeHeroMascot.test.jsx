import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomeHeroMascot from './HomeHeroMascot'

describe('HomeHeroMascot', () => {
  afterEach(() => vi.useRealTimers())

  it('đổi cảm xúc và pose trong lúc tuần tra phía trên tìm kiếm', () => {
    vi.useFakeTimers()
    const { container } = render(<HomeHeroMascot />)
    const mascot = () => container.querySelector('.procv-mascot')

    expect(mascot()).toHaveAttribute('data-emotion', 'happy')
    expect(mascot()).toHaveAttribute('data-pose', 'wave')

    act(() => vi.advanceTimersByTime(3800))
    expect(mascot()).toHaveAttribute('data-emotion', 'thinking')
    expect(mascot()).toHaveAttribute('data-pose', 'neutral')

    act(() => vi.advanceTimersByTime(3800))
    expect(mascot()).toHaveAttribute('data-emotion', 'success')
    expect(mascot()).toHaveAttribute('data-pose', 'thumbsUp')
  })
})

