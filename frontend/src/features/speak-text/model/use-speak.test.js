import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTextSpeechSession } from '@/entities/speech'
import { useSpeak } from './use-speak'

const player = vi.hoisted(() => ({
  callbacks: null,
  destroy: vi.fn(),
  play: vi.fn(),
  reset: vi.fn(),
  unlock: vi.fn(),
}))

vi.mock('@/entities/speech', () => ({ createTextSpeechSession: vi.fn() }))

vi.mock('@/shared/lib/speech/pcm-stream-player', () => ({
  PcmStreamPlayer: class {
    constructor(callbacks) {
      player.callbacks = callbacks
    }

    unlock(...args) {
      player.unlock(...args)
    }

    reset() {
      player.reset()
    }

    async play(...args) {
      return player.play(...args)
    }

    destroy() {
      player.destroy()
    }
  },
}))

const SESSION = {
  stream_url: '/tts/v1/streams/opaque-token-value-123456',
  sample_rate: 48_000,
  cached: false,
  voice_id: 'north-male-natural',
  style: 'tu_nhien',
}

describe('useSpeak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    player.play.mockImplementation(async () => player.callbacks.onFirstAudio())
    createTextSpeechSession.mockResolvedValue(SESSION)
  })

  it('speaks any sentence from one call and reports playing', async () => {
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    await act(async () => {
      await result.current.speak('Tôi tìm được ba việc phù hợp với bạn.')
    })

    expect(createTextSpeechSession).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'chatbot',
      text: 'Tôi tìm được ba việc phù hợp với bạn.',
    }))
    expect(player.play).toHaveBeenCalledWith(
      SESSION.stream_url,
      expect.objectContaining({ rate: 1, sampleRate: 48_000 }),
    )
    expect(result.current.status).toBe('playing')
    expect(result.current.speaking).toBe(true)
  })

  it('reports elapsed playback time for synchronized UI', async () => {
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    await act(async () => {
      await result.current.speak('Tôi đang đọc câu trả lời này.')
    })
    act(() => player.callbacks.onTimeUpdate(1.25))

    expect(result.current.elapsed).toBe(1.25)
  })

  it('unlocks Web Audio synchronously before the first await', async () => {
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))
    let pending

    // Trình duyệt chỉ mở AudioContext bên trong cử chỉ: unlock phải xảy ra
    // trước khi hàm nhả điều khiển cho request tạo session.
    act(() => {
      pending = result.current.speak('Xin chào.')
    })
    const unlockedBeforeRequest = player.unlock.mock.calls.length

    await act(async () => {
      await pending
    })

    expect(unlockedBeforeRequest).toBe(1)
  })

  it('lets a surface unlock on an earlier gesture so it can speak later', () => {
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    act(() => {
      expect(result.current.unlock()).toBe(true)
    })

    expect(player.unlock).toHaveBeenCalledTimes(1)
    expect(createTextSpeechSession).not.toHaveBeenCalled()
  })

  it('never reaches the network for an empty line', async () => {
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    await act(async () => {
      await result.current.speak('   ')
    })

    expect(createTextSpeechSession).not.toHaveBeenCalled()
    expect(player.unlock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('abandons the previous line when a new one interrupts it', async () => {
    createTextSpeechSession.mockImplementation(({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      if (signal.aborted) return
      window.setTimeout(() => resolve(SESSION), 0)
    }))
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    await act(async () => {
      const first = result.current.speak('Câu đầu tiên.')
      const second = result.current.speak('Câu thứ hai.')
      await Promise.all([first, second])
    })

    expect(createTextSpeechSession).toHaveBeenCalledTimes(2)
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('playing')
  })

  it('surfaces a busy engine as a retry message rather than a hard failure', async () => {
    const busy = new Error('Service Unavailable')
    busy.status = 503
    createTextSpeechSession.mockRejectedValue(busy)
    const { result } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    await act(async () => {
      await result.current.speak('Xin chào.')
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Hệ thống đọc đang bận. Vui lòng thử lại sau ít phút.')
    expect(result.current.speaking).toBe(false)
  })

  it('releases the audio engine on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    act(() => {
      result.current.unlock()
    })
    unmount()

    expect(player.destroy).toHaveBeenCalledTimes(1)
  })

  it('costs nothing until a surface actually asks for audio', () => {
    const { unmount } = renderHook(() => useSpeak({ surface: 'chatbot' }))

    unmount()

    expect(player.unlock).not.toHaveBeenCalled()
    expect(player.destroy).not.toHaveBeenCalled()
  })
})
