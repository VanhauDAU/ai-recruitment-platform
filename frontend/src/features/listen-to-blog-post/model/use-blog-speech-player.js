import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpeechVoiceCatalog } from '@/entities/speech'
import { playLiveBlogSpeech } from './live-speech-stream'
import {
  connectionAllowsPreload,
  findPreparedAsset,
  now,
  retryableStatus,
  storedSpeechRate,
  storedSpeechStyle,
  storedSpeechVoice,
  storeSpeechPreferences,
  storeSpeechRate,
} from './speech-playback-utils'
import { useSpeechEngines } from './use-speech-engines'

const EMPTY_PREPARED_ASSETS = Object.freeze([])

export function useBlogSpeechPlayer(
  sourcePublicId,
  { defaultAsset, onTiming, preparedAssets = EMPTY_PREPARED_ASSETS } = {},
) {
  const playbackModeRef = useRef(null)
  const activeConfigRef = useRef(null)
  const requestRef = useRef(null)
  const interactionAtRef = useRef(0)
  const mountedRef = useRef(true)
  const onTimingRef = useRef(onTiming)
  onTimingRef.current = onTiming

  const [panelOpen, setPanelOpen] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [voiceId, setVoiceId] = useState(storedSpeechVoice)
  const [style, setStyle] = useState(storedSpeechStyle)
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
    const nextVoiceId = overrides.voiceId ?? voiceId
    const nextStyle = overrides.style ?? style
    const nextRate = Number(overrides.rate ?? rate)
    const asset = findPreparedAsset(
      defaultAsset,
      preparedAssets,
      nextVoiceId,
      nextStyle,
    )
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
        const resolvedVoice = asset.voiceId || nextVoiceId
        const resolvedStyle = asset.style || nextStyle || 'tu_nhien'
        const nativePlayer = ensureNativePlayer()
        playbackModeRef.current = 'native'
        activeConfigRef.current = { cached: true, style: resolvedStyle, voiceId: resolvedVoice }
        setVoiceId(resolvedVoice)
        setStyle(resolvedStyle)
        setRate(nextRate)
        storeSpeechPreferences({ rate: nextRate, style: resolvedStyle, voiceId: resolvedVoice })
        setCached(true)
        setTruncated(false)
        setStatus('buffering')
        await nativePlayer.play(asset.url, { rate: nextRate })
        return
      }

      await playLiveBlogSpeech({
        onQueued: (attempt) => reportTiming('queued', { attempt, mode: 'live-pcm' }),
        onSession: (session, config) => {
          setVoiceId(config.voiceId)
          setStyle(config.style)
          setRate(nextRate)
          storeSpeechPreferences({ rate: nextRate, style: config.style, voiceId: config.voiceId })
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
        style: nextStyle,
        voiceId: nextVoiceId,
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
  }, [defaultAsset, ensureNativePlayer, ensurePlayer, preparedAssets, rate, reportTiming, resetPlayback, sourcePublicId, style, voiceId])

  const loadCatalog = useCallback(async () => {
    if (catalog || catalogLoading) return
    setCatalogLoading(true)
    try {
      const nextCatalog = await getSpeechVoiceCatalog()
      if (!nextCatalog?.voices?.length) throw new Error('Danh sách giọng đọc đang trống.')
      setCatalog(nextCatalog)
      setVoiceId((current) => (
        nextCatalog.voices.some((voice) => voice.id === current)
          ? current
          : nextCatalog.default_voice_id
      ))
      setStyle((current) => (
        nextCatalog.styles.some((item) => item.id === current) ? current : 'tu_nhien'
      ))
    } catch (nextError) {
      setError(nextError.response?.data?.detail || nextError.message || 'Chưa thể tải danh sách giọng.')
    } finally {
      setCatalogLoading(false)
    }
  }, [catalog, catalogLoading])

  const railClick = useCallback(() => {
    if (status === 'idle') {
      start()
      return
    }
    setPanelOpen(true)
    if (status !== 'error') loadCatalog()
  }, [loadCatalog, start, status])

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
    const active = activeConfigRef.current
    const sameVoiceAndStyle = active
      && active.voiceId === voiceId
      && active.style === style
    if (sameVoiceAndStyle && ['playing', 'paused', 'rebuffering'].includes(status)) {
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
    start({ rate, style, voiceId })
  }, [nativePlayerRef, playerRef, rate, reportTiming, start, status, style, voiceId])

  const preloadDefault = useCallback(() => {
    if (!connectionAllowsPreload()) return false
    const asset = findPreparedAsset(defaultAsset, preparedAssets, voiceId, style)
    if (!asset) return false
    ensureNativePlayer().preload(asset.url)
    reportTiming('asset-preload', { mode: 'prepared-asset' })
    return true
  }, [defaultAsset, ensureNativePlayer, preparedAssets, reportTiming, style, voiceId])

  useEffect(() => {
    stop()
    releaseEngines()
    setCatalog(null)
    setPanelOpen(false)
    setError('')
  }, [sourcePublicId, defaultAsset?.url, preparedAssets, releaseEngines, stop])

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
    catalog,
    catalogLoading,
    elapsed,
    error,
    loadCatalog,
    panelOpen,
    preloadDefault,
    railClick,
    rate,
    setPanelOpen,
    setRate,
    setStyle,
    setVoiceId,
    start,
    status,
    stop,
    style,
    togglePause,
    truncated,
    voiceId,
  }
}
