import { useCallback, useEffect, useRef, useState } from 'react'
import { now, retryableStatus } from '@/shared/lib/speech/stream-retry'
import { playLiveBlogSpeech } from './live-speech-stream'
import {
  connectionAllowsPreload,
  findPreparedAsset,
  storedSpeechRate,
  storeSpeechRate,
} from './speech-playback-utils'
import { useSpeechEngines } from './use-speech-engines'

export function useBlogSpeechPlayer(
  sourcePublicId,
  { defaultAsset, onTiming } = {},
) {
  const playbackModeRef = useRef(null)
  const activeConfigRef = useRef(null)
  const requestRef = useRef(null)
  const interactionAtRef = useRef(0)
  const mountedRef = useRef(true)
  const onTimingRef = useRef(onTiming)
  onTimingRef.current = onTiming

  const [panelOpen, setPanelOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [rate, setRate] = useState(storedSpeechRate)
  const [elapsed, setElapsed] = useState(0)
  const [cached, setCached] = useState(false)
  const [truncated, setTruncated] = useState(false)

  const reportTiming = useCallback((name, detail = {}) => {
    const payload = { ...detail, name, sourcePublicId }
    try {
      window.performance?.mark?.(`blog-speech:${name}`)
    } catch {
      // Performance marks are optional diagnostics.
    }
    onTimingRef.current?.(payload)
  }, [sourcePublicId])

  const reportFirstAudio = useCallback((mode, extra = {}) => {
    const startedAt = interactionAtRef.current
    reportTiming('first-audio', {
      ...extra,
      clickToAudioMs: startedAt ? Math.round(now() - startedAt) : undefined,
      mode,
    })
  }, [reportTiming])

  const {
    ensureNativePlayer,
    ensurePlayer,
    nativePlayerRef,
    playerRef,
    releaseEngines,
    resetEngines,
  } = useSpeechEngines({
    activeConfigRef,
    mountedRef,
    reportFirstAudio,
    setElapsed,
    setError,
    setPanelOpen,
    setStatus,
  })

  const resetPlayback = useCallback(() => {
    resetEngines()
    playbackModeRef.current = null
    activeConfigRef.current = null
  }, [resetEngines])

  const stop = useCallback(({ nextStatus = 'idle' } = {}) => {
    requestRef.current?.abort()
    requestRef.current = null
    resetPlayback()
    setElapsed(0)
    setCached(false)
    setTruncated(false)
    setError('')
    setStatus(nextStatus)
  }, [resetPlayback])

  const start = useCallback(async (overrides = {}) => {
    const nextRate = Number(overrides.rate ?? rate)
    const asset = findPreparedAsset(defaultAsset)
    const usePreparedAsset = Boolean(asset)
    let player = null

    // Web Audio must be unlocked synchronously inside the click gesture. Native
    // audio calls play synchronously below for the same browser autoplay rule.
    if (!usePreparedAsset) {
      player = ensurePlayer()
      try {
        player.unlock()
      } catch (nextError) {
        setError(nextError.message)
        setStatus('error')
        setPanelOpen(true)
        return
      }
    }

    requestRef.current?.abort()
    resetPlayback()
    const controller = new AbortController()
    requestRef.current = controller
    interactionAtRef.current = now()
    reportTiming('play-requested', { mode: usePreparedAsset ? 'prepared-asset' : 'live-pcm' })
    setError('')
    setElapsed(0)

    try {
      if (usePreparedAsset) {
        const nativePlayer = ensureNativePlayer()
        playbackModeRef.current = 'native'
        activeConfigRef.current = {
          cached: true,
          style: asset.style,
          voiceId: asset.voiceId,
        }
        setRate(nextRate)
        storeSpeechRate(nextRate)
        setCached(true)
        setTruncated(false)
        setStatus('buffering')
        await nativePlayer.play(asset.url, { rate: nextRate })
        return
      }

      await playLiveBlogSpeech({
        onQueued: (attempt) => reportTiming('queued', { attempt, mode: 'live-pcm' }),
        onSession: (session, config) => {
          setRate(nextRate)
          storeSpeechRate(nextRate)
          setCached(config.cached)
          setTruncated(Boolean(session.truncated))
          playbackModeRef.current = 'pcm'
          activeConfigRef.current = config
          reportTiming('session-ready', { cached: config.cached, mode: 'live-pcm' })
        },
        onStatus: setStatus,
        player,
        rate: nextRate,
        signal: controller.signal,
        sourcePublicId,
      })
    } catch (nextError) {
      if (controller.signal.aborted || nextError.name === 'AbortError') return
      setStatus('error')
      setError(
        retryableStatus(nextError)
          ? 'Hệ thống đọc đang bận. Vui lòng thử lại sau ít phút.'
          : nextError.response?.data?.detail
            || nextError.message
            || 'Chưa thể tạo giọng đọc. Vui lòng thử lại sau.',
      )
      setPanelOpen(true)
      reportTiming('playback-error', { mode: playbackModeRef.current || 'unknown' })
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [defaultAsset, ensureNativePlayer, ensurePlayer, rate, reportTiming, resetPlayback, sourcePublicId])

  const railClick = useCallback(() => {
    if (status === 'idle') {
      start()
      return
    }
    setPanelOpen(true)
  }, [start, status])

  const togglePause = useCallback(() => {
    if (status === 'playing' || status === 'rebuffering') {
      if (playbackModeRef.current === 'native') nativePlayerRef.current?.pause()
      else playerRef.current?.pause()
      setStatus('paused')
    } else if (status === 'paused') {
      if (playbackModeRef.current === 'native') {
        nativePlayerRef.current?.resume().catch((nextError) => {
          if (!mountedRef.current) return
          setStatus('error')
          setError(nextError.message || 'Chưa thể tiếp tục phát âm thanh.')
        })
      } else {
        playerRef.current?.resume()
        setStatus('playing')
      }
    }
  }, [nativePlayerRef, playerRef, status])

  const apply = useCallback(() => {
    if (activeConfigRef.current && ['playing', 'paused', 'rebuffering'].includes(status)) {
      const nextRate = Number(rate)
      if (playbackModeRef.current === 'native') {
        nativePlayerRef.current?.setRate(nextRate)
      } else {
        playerRef.current?.setRate(nextRate)
      }
      storeSpeechRate(nextRate)
      setPanelOpen(false)
      reportTiming('rate-changed', { mode: playbackModeRef.current, rate: nextRate })
      return
    }
    setPanelOpen(false)
    start({ rate })
  }, [nativePlayerRef, playerRef, rate, reportTiming, start, status])

  const preloadDefault = useCallback(() => {
    if (!connectionAllowsPreload()) return false
    const asset = findPreparedAsset(defaultAsset)
    if (!asset) return false
    ensureNativePlayer().preload(asset.url)
    reportTiming('asset-preload', { mode: 'prepared-asset' })
    return true
  }, [defaultAsset, ensureNativePlayer, reportTiming])

  useEffect(() => {
    stop()
    releaseEngines()
    setPanelOpen(false)
    setError('')
  }, [sourcePublicId, defaultAsset?.url, releaseEngines, stop])

  useEffect(() => {
    const requestIdle = window.requestIdleCallback?.bind(window)
    const cancelIdle = window.cancelIdleCallback?.bind(window)
    const schedule = requestIdle
      ? (callback) => requestIdle(callback, { timeout: 2_500 })
      : (callback) => window.setTimeout(callback, 800)
    const cancel = cancelIdle
      ? (handle) => cancelIdle(handle)
      : (handle) => window.clearTimeout(handle)
    const handle = schedule(preloadDefault)
    return () => cancel(handle)
  }, [preloadDefault])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current?.abort()
      releaseEngines()
    }
  }, [releaseEngines])

  return {
    apply,
    cached,
    elapsed,
    error,
    panelOpen,
    preloadDefault,
    railClick,
    rate,
    setPanelOpen,
    setRate,
    start,
    status,
    stop,
    togglePause,
    truncated,
  }
}
