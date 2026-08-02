import { useCallback, useRef } from 'react'
import { NativeAudioPlayer } from './native-audio-player'
import { PcmStreamPlayer } from './pcm-stream-player'

export function useSpeechEngines({
  activeConfigRef,
  mountedRef,
  reportFirstAudio,
  setElapsed,
  setError,
  setPanelOpen,
  setStatus,
}) {
  const playerRef = useRef(null)
  const nativePlayerRef = useRef(null)

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new PcmStreamPlayer({
        onEnded: () => mountedRef.current && setStatus('ended'),
        onError: (error) => {
          if (!mountedRef.current) return
          setStatus('error')
          setError(error.message || 'Luồng âm thanh bị gián đoạn.')
          setPanelOpen(true)
        },
        onFirstAudio: () => {
          if (!mountedRef.current) return
          setStatus('playing')
          reportFirstAudio('live-pcm', { cached: Boolean(activeConfigRef.current?.cached) })
        },
        onRebuffering: (waiting) => {
          if (!mountedRef.current) return
          setStatus((current) => {
            if (waiting) return current === 'playing' ? 'rebuffering' : current
            return current === 'rebuffering' ? 'playing' : current
          })
        },
        onTimeUpdate: (value) => mountedRef.current && setElapsed(value),
      })
    }
    return playerRef.current
  }, [activeConfigRef, mountedRef, reportFirstAudio, setElapsed, setError, setPanelOpen, setStatus])

  const ensureNativePlayer = useCallback(() => {
    if (!nativePlayerRef.current) {
      nativePlayerRef.current = new NativeAudioPlayer({
        onEnded: () => mountedRef.current && setStatus('ended'),
        onError: () => {
          if (!mountedRef.current) return
          setStatus('error')
          setError('Bản đọc nhanh chưa tải được. Bạn có thể thử phát lại hoặc chọn giọng khác.')
          setPanelOpen(true)
        },
        onFirstAudio: () => {
          if (!mountedRef.current) return
          setStatus('playing')
          reportFirstAudio('prepared-asset', { cached: true })
        },
        onRebuffering: () => {
          if (!mountedRef.current) return
          setStatus((current) => (current === 'playing' ? 'rebuffering' : 'buffering'))
        },
        onResumed: () => mountedRef.current && setStatus('playing'),
        onTimeUpdate: (value) => mountedRef.current && setElapsed(value),
      })
    }
    return nativePlayerRef.current
  }, [mountedRef, reportFirstAudio, setElapsed, setError, setPanelOpen, setStatus])

  const resetEngines = useCallback(() => {
    nativePlayerRef.current?.reset()
    playerRef.current?.reset()
  }, [])

  const releaseEngines = useCallback(() => {
    playerRef.current?.destroy()
    nativePlayerRef.current?.release()
    playerRef.current = null
    nativePlayerRef.current = null
  }, [])

  return { ensureNativePlayer, ensurePlayer, nativePlayerRef, playerRef, releaseEngines, resetEngines }
}
