import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HeroTypingTitle from './HeroTypingTitle'

function mockMedia({ phone, reduced = false }) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('reduced-motion') ? reduced : phone,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('HeroTypingTitle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('types the phrases on phones while the heading keeps the full title', () => {
    mockMedia({ phone: true })
    const { container } = render(<HeroTypingTitle siteName="ProCV" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ProCV — Tạo CV chuyên nghiệp, Tìm việc nhanh chóng, Tuyển dụng hiệu quả')
    const typed = () => container.querySelector('.home-typing-text').textContent
    expect(typed()).toBe('Tạo CV chuyên nghiệp')

    // Mỗi bước là một timer mới sau render: đẩy đồng hồ từng nhịp.
    const tick = (ms, times) => {
      for (let i = 0; i < times; i += 1) act(() => vi.advanceTimersByTime(ms))
    }
    tick(1800, 1)
    tick(32, 20)
    expect(typed()).toBe('')
    tick(350, 1)
    tick(130, 20)
    expect(typed()).toBe('Tìm việc nhanh chóng')
  })

  it('shows the static title on desktop and with reduced motion', () => {
    mockMedia({ phone: true, reduced: true })
    const { container, unmount } = render(<HeroTypingTitle siteName="ProCV" />)
    expect(container.querySelector('.home-typing')).toBeNull()
    unmount()

    mockMedia({ phone: false })
    render(<HeroTypingTitle siteName="ProCV" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ProCV — Tạo CV chuyên nghiệp, Tìm việc nhanh chóng, Tuyển dụng hiệu quả')
  })
})
