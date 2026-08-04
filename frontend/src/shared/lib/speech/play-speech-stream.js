import {
  MAX_QUEUE_WAIT_MS,
  MAX_STREAM_ATTEMPTS,
  now,
  retryDelayMs,
  retryableStatus,
  sleep,
} from './stream-retry'

/**
 * Mở luồng của một session đã tạo, chịu được vài nhịp xếp hàng ngắn.
 *
 * Engine chạy số worker cố định nên 429/503 ngay lúc mở luồng là "đang bận",
 * không phải hỏng; thử lại trong hạn ngắn rẻ hơn nhiều so với bắt người dùng
 * bấm lại và tạo thêm một session mới.
 */
export async function playSpeechStream({ onQueued, onStatus, player, rate, session, signal }) {
  const queueStartedAt = now()
  for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt += 1) {
    try {
      onStatus?.('buffering')
      await player.play(session.stream_url, {
        cached: Boolean(session.cached),
        rate,
        sampleRate: session.sample_rate,
        signal,
      })
      return
    } catch (error) {
      const elapsedWaiting = now() - queueStartedAt
      const canRetry = retryableStatus(error)
        && attempt + 1 < MAX_STREAM_ATTEMPTS
        && elapsedWaiting < MAX_QUEUE_WAIT_MS
      if (!canRetry) throw error
      onStatus?.('queued')
      onQueued?.(attempt + 1)
      const remaining = MAX_QUEUE_WAIT_MS - elapsedWaiting
      await sleep(Math.min(retryDelayMs(error), remaining), signal)
    }
  }
}
