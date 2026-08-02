import { createBlogSpeechSession } from '@/entities/speech'
import {
  MAX_QUEUE_WAIT_MS,
  MAX_STREAM_ATTEMPTS,
  now,
  retryDelayMs,
  retryableStatus,
  sleep,
} from './speech-playback-utils'

/** Create the protected session, then open its stream with a short bounded queue. */
export async function playLiveBlogSpeech({
  onQueued,
  onSession,
  onStatus,
  player,
  rate,
  signal,
  sourcePublicId,
  style,
  voiceId,
}) {
  onStatus('creating')
  const session = await createBlogSpeechSession({ sourcePublicId, style, voiceId, signal })
  if (signal.aborted) return

  const config = {
    cached: Boolean(session.cached),
    style: session.style || style || 'tu_nhien',
    voiceId: session.voice_id || voiceId,
  }
  onSession(session, config)

  const queueStartedAt = now()
  for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt += 1) {
    try {
      onStatus('buffering')
      await player.play(session.stream_url, {
        cached: config.cached,
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
      onStatus('queued')
      onQueued(attempt + 1)
      const remaining = MAX_QUEUE_WAIT_MS - elapsedWaiting
      await sleep(Math.min(retryDelayMs(error), remaining), signal)
    }
  }
}
