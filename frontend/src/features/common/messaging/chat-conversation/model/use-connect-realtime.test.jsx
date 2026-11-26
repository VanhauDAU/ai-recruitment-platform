import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConnectRealtime } from './use-connect-realtime'
import { TYPING_VISIBLE_MS } from './realtime-sync'

const realtime = vi.hoisted(() => ({ handler: null }))
vi.mock('@/shared/api/use-realtime', () => ({ useRealtimeEvents: (handler) => { realtime.handler = handler } }))

describe('useConnectRealtime typing', () => {
  afterEach(() => vi.useRealTimers())

  it('extends the typing hint without re-rendering on every signal', () => {
    vi.useFakeTimers()
    let renders = 0
    const client = new QueryClient()
    const { result } = renderHook(() => {
      renders += 1
      return useConnectRealtime({ portal: 'candidate', activeId: 'c1' })
    }, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })

    act(() => realtime.handler({ type: 'chat.typing', conversation: 'c1' }))
    expect(result.current).toBe('c1')
    const afterFirst = renders
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        vi.advanceTimersByTime(TYPING_VISIBLE_MS - 1000)
        realtime.handler({ type: 'chat.typing', conversation: 'c1' })
      })
    }
    // Hint stays on past the first deadline, with at most React's one bail-out render.
    expect(result.current).toBe('c1')
    expect(renders - afterFirst).toBeLessThanOrEqual(1)
    act(() => vi.advanceTimersByTime(TYPING_VISIBLE_MS))
    expect(result.current).toBeNull()
  })
})
