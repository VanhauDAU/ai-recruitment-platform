import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProgressiveReply } from './use-progressive-reply'

const TEXT = 'Bạn có thể tìm việc phù hợp ngay hôm nay.'

function props(overrides = {}) {
  return {
    active: true,
    elapsed: 0,
    enabled: true,
    progressive: true,
    reducedMotion: false,
    status: 'creating',
    text: TEXT,
    ...overrides,
  }
}

describe('useProgressiveReply', () => {
  afterEach(() => vi.useRealTimers())

  it('mở dần nội dung theo thời gian audio và hoàn tất khi giọng đọc kết thúc', () => {
    vi.useFakeTimers()
    const { rerender, result } = renderHook((input) => useProgressiveReply(input), {
      initialProps: props(),
    })
    expect(result.current.text).toBe('')

    rerender(props({ elapsed: 1, status: 'playing' }))
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.text.length).toBeGreaterThan(0)
    expect(result.current.text.length).toBeLessThan(TEXT.length)
    expect(result.current.typing).toBe(true)

    rerender(props({ elapsed: 10, status: 'ended' }))
    act(() => vi.advanceTimersByTime(TEXT.length * 40))
    expect(result.current.text).toBe(TEXT)
    expect(result.current.complete).toBe(true)
  })

  it('nội suy từng ký tự thay vì nhảy theo cụm callback audio', () => {
    vi.useFakeTimers()
    const { rerender, result } = renderHook((input) => useProgressiveReply(input), {
      initialProps: props(),
    })

    rerender(props({ elapsed: 1, status: 'playing' }))
    act(() => vi.advanceTimersByTime(72))
    expect(result.current.text).toHaveLength(1)

    act(() => vi.advanceTimersByTime(72))
    expect(result.current.text).toHaveLength(2)
  })

  it('không dùng nhầm trạng thái ended còn sót từ response trước', () => {
    vi.useFakeTimers()
    const { rerender, result } = renderHook((input) => useProgressiveReply(input), {
      initialProps: props({ elapsed: 8, status: 'ended' }),
    })

    expect(result.current.text).toBe('')
    rerender(props({ status: 'creating' }))
    rerender(props({ elapsed: 0.8, status: 'playing' }))
    act(() => vi.advanceTimersByTime(400))

    expect(result.current.text.length).toBeGreaterThan(0)
    expect(result.current.text.length).toBeLessThan(TEXT.length)
  })

  it('tự đánh máy đầy đủ khi TTS lỗi', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProgressiveReply(props({ status: 'error' })))

    act(() => vi.advanceTimersByTime(TEXT.length * 40))

    expect(result.current.text).toBe(TEXT)
    expect(result.current.complete).toBe(true)
  })

  it('không để response bị kẹt khi dịch vụ đọc chờ quá lâu', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProgressiveReply(props({ status: 'buffering' })))

    act(() => vi.advanceTimersByTime(2300))
    act(() => vi.advanceTimersByTime(TEXT.length * 40))

    expect(result.current.text).toBe(TEXT)
  })

  it('hiện ngay toàn bộ nội dung khi người dùng giảm chuyển động', () => {
    const { result } = renderHook(() => useProgressiveReply(props({ reducedMotion: true })))

    expect(result.current.text).toBe(TEXT)
    expect(result.current.typing).toBe(false)
  })
})
