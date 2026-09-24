import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProgressiveReply } from './use-progressive-reply'

const TEXT = 'Bạn có thể tìm việc phù hợp ngay hôm nay.'

function props(overrides = {}) {
  return {
    active: true,
    progressive: true,
    reducedMotion: false,
    text: TEXT,
    ...overrides,
  }
}

describe('useProgressiveReply', () => {
  afterEach(() => vi.useRealTimers())

  it('hiện dần từng ký tự rồi hoàn tất', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProgressiveReply(props()))

    expect(result.current.text).toBe('')
    act(() => vi.advanceTimersByTime(72))
    expect(result.current.text).toHaveLength(2)
    expect(result.current.typing).toBe(true)

    act(() => vi.advanceTimersByTime(TEXT.length * 40))
    expect(result.current.text).toBe(TEXT)
    expect(result.current.complete).toBe(true)
  })

  it('hiện ngay toàn bộ nội dung khi giảm chuyển động', () => {
    const { result } = renderHook(() => useProgressiveReply(props({ reducedMotion: true })))

    expect(result.current.text).toBe(TEXT)
    expect(result.current.typing).toBe(false)
  })

  it('hiện ngay nội dung không ở trạng thái active', () => {
    const { result } = renderHook(() => useProgressiveReply(props({ active: false })))

    expect(result.current.text).toBe(TEXT)
  })
})
