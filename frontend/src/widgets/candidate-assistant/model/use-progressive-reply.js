import { useEffect, useMemo, useState } from 'react'

const SYNC_CHARACTERS_PER_SECOND = 13
const AUDIO_LOOKAHEAD_SECONDS = 0.45
const SYNC_INTERVAL_MS = 72
const FALLBACK_DELAY_MS = 2200
const FALLBACK_INTERVAL_MS = 36

function audioCharacterTarget(length, elapsed) {
  if (!length) return 0
  // Đi trước timestamp audio một khoảng nhỏ để bộ nội suy có đủ ký tự mục tiêu
  // và không phải dừng/chạy lại theo nhịp callback 250ms của player.
  const estimated = Math.ceil(
    (Math.max(0, elapsed) + AUDIO_LOOKAHEAD_SECONDS) * SYNC_CHARACTERS_PER_SECOND,
  )
  // Chừa ký tự cuối đến sự kiện ended để câu không hoàn tất trước giọng đọc.
  return Math.min(Math.max(length - 1, 1), estimated)
}

/**
 * Hiện dần phản hồi theo tiến độ Web Audio. TTS không có timestamp từng từ,
 * nên dùng elapsed time làm đồng hồ gần đúng; khi audio không dùng được thì
 * chuyển sang typewriter độc lập để nội dung không bao giờ bị kẹt.
 */
export function useProgressiveReply({
  active,
  elapsed = 0,
  enabled,
  progressive,
  reducedMotion,
  status = 'idle',
  text,
}) {
  const characters = useMemo(() => Array.from(text || ''), [text])
  const [visibleCount, setVisibleCount] = useState(
    () => (progressive && !reducedMotion ? 0 : characters.length),
  )
  const [fallback, setFallback] = useState(false)
  const [speechStarted, setSpeechStarted] = useState(false)
  const [syncTarget, setSyncTarget] = useState(0)

  useEffect(() => {
    setVisibleCount(progressive && !reducedMotion ? 0 : characters.length)
    setFallback(false)
    setSpeechStarted(false)
    setSyncTarget(0)
  }, [characters, progressive, reducedMotion])

  useEffect(() => {
    if (!progressive || reducedMotion || !active) {
      setVisibleCount(characters.length)
      return undefined
    }
    if (['creating', 'buffering', 'queued', 'playing'].includes(status)) {
      setSpeechStarted(true)
    }
    // `ended` có thể còn sót từ câu trước trong render đầu của response mới.
    // Chỉ nhận ended sau khi chính response này đã đi qua một trạng thái active.
    if (status === 'ended' && speechStarted) {
      // Hoàn thiện vài ký tự cuối bằng typewriter nhanh thay vì nhảy nguyên
      // phần còn thiếu khi callback ended đến sớm hơn ước lượng ký tự.
      setSyncTarget(characters.length)
      setFallback(true)
      return undefined
    }
    if (!enabled || status === 'error') {
      setFallback(true)
      return undefined
    }
    if (status === 'playing' || (status === 'buffering' && elapsed > 0)) {
      setFallback(false)
      setSyncTarget((current) => Math.max(
        current,
        audioCharacterTarget(characters.length, elapsed),
      ))
    }
    return undefined
  }, [active, characters.length, elapsed, enabled, progressive, reducedMotion, speechStarted, status])

  useEffect(() => {
    const syncing = status === 'playing' || (status === 'buffering' && elapsed > 0)
    if (!syncing || fallback || visibleCount >= syncTarget) return undefined
    const timer = window.setInterval(() => {
      setVisibleCount((current) => Math.min(syncTarget, current + 1))
    }, SYNC_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [elapsed, fallback, status, syncTarget, visibleCount])

  useEffect(() => {
    if (!progressive || reducedMotion || !active || !enabled) return undefined
    if (status === 'playing' || status === 'error' || (status === 'ended' && speechStarted)) {
      return undefined
    }
    const timer = window.setTimeout(() => setFallback(true), FALLBACK_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, enabled, progressive, reducedMotion, speechStarted, status])

  useEffect(() => {
    if (!fallback || visibleCount >= characters.length) return undefined
    const timer = window.setInterval(() => {
      setVisibleCount((current) => Math.min(characters.length, current + 1))
    }, FALLBACK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [characters.length, fallback, visibleCount])

  return {
    complete: visibleCount >= characters.length,
    text: characters.slice(0, visibleCount).join(''),
    typing: visibleCount < characters.length,
  }
}
