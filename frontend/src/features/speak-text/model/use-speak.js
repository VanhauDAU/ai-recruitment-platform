import { useCallback, useEffect, useRef, useState } from 'react'
import { createTextSpeechSession } from '@/entities/speech'
import { playSpeechStream } from '@/shared/lib/speech/play-speech-stream'
import { PcmStreamPlayer } from '@/shared/lib/speech/pcm-stream-player'
import { retryableStatus } from '@/shared/lib/speech/stream-retry'

const BUSY_MESSAGE = 'Hệ thống đọc đang bận. Vui lòng thử lại sau ít phút.'
const FAILED_MESSAGE = 'Chưa thể tạo giọng đọc. Vui lòng thử lại sau.'
const ACTIVE_STATUSES = ['creating', 'buffering', 'queued', 'playing']

/**
 * Đọc to một câu bất kỳ: `useSpeak({ surface: 'chatbot' })`, rồi gọi `speak()`.
 *
 * Trình duyệt chỉ cho mở AudioContext bên trong cử chỉ của người dùng, nên lần
 * phát đầu tiên phải nằm trong handler click/tap. Bề mặt cần tự nói sau đó (ví
 * dụ robot trả lời) thì gọi `unlock()` ngay ở lần bấm đầu tiên — mở panel, bấm
 * gửi — rồi `speak()` tự do về sau.
 *
 * Câu nói không được lưu thành asset lâu dài: lần đọc lại cùng một câu ăn cache
 * của engine nên gần như tức thì, còn câu mới thì tổng hợp trực tiếp.
 */
export function useSpeak({ rate = 1, surface } = {}) {
  const playerRef = useRef(null)
  const requestRef = useRef(null)
  const mountedRef = useRef(true)
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new PcmStreamPlayer({
        onEnded: () => mountedRef.current && setStatus('ended'),
        onError: (nextError) => {
          if (!mountedRef.current) return
          setStatus('error')
          setError(nextError.message || 'Luồng âm thanh bị gián đoạn.')
        },
        onFirstAudio: () => {
          if (!mountedRef.current) return
          setElapsed(0)
          setStatus('playing')
        },
        onRebuffering: (waiting) => {
          if (!mountedRef.current || !waiting) return
          setStatus((current) => (current === 'playing' ? 'buffering' : current))
        },
        onTimeUpdate: (seconds) => {
          if (mountedRef.current) setElapsed(seconds)
        },
      })
    }
    return playerRef.current
  }, [])

  const unlock = useCallback(() => {
    try {
      ensurePlayer().unlock()
      return true
    } catch {
      // Trình duyệt không hỗ trợ Web Audio: bề mặt gọi vẫn chạy bình thường,
      // chỉ là không có tiếng.
      return false
    }
  }, [ensurePlayer])

  const stop = useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
    playerRef.current?.reset()
    setElapsed(0)
    setError('')
    setStatus('idle')
  }, [])

  const speak = useCallback(async (text) => {
    if (!text?.trim()) return
    // Phải mở Web Audio đồng bộ trong cử chỉ; mọi `await` đều nằm phía sau.
    const player = ensurePlayer()
    try {
      player.unlock()
    } catch (nextError) {
      setStatus('error')
      setError(nextError.message)
      return
    }

    requestRef.current?.abort()
    player.reset()
    const controller = new AbortController()
    requestRef.current = controller
    setElapsed(0)
    setError('')
    setStatus('creating')

    try {
      const session = await createTextSpeechSession({
        signal: controller.signal,
        surface,
        text,
      })
      if (controller.signal.aborted) return
      await playSpeechStream({
        onStatus: setStatus,
        player,
        rate,
        session,
        signal: controller.signal,
      })
    } catch (nextError) {
      if (controller.signal.aborted || nextError.name === 'AbortError') return
      if (!mountedRef.current) return
      setStatus('error')
      setError(
        retryableStatus(nextError)
          ? BUSY_MESSAGE
          : nextError.response?.data?.detail || nextError.message || FAILED_MESSAGE,
      )
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [ensurePlayer, rate, surface])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current?.abort()
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  return {
    elapsed,
    error,
    speak,
    speaking: ACTIVE_STATUSES.includes(status),
    status,
    stop,
    unlock,
  }
}
