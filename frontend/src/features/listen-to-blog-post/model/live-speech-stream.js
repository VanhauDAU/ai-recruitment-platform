import { createBlogSpeechSession } from '@/entities/speech'
import { playSpeechStream } from '@/shared/lib/speech/play-speech-stream'

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

  await playSpeechStream({ onQueued, onStatus, player, rate, session, signal })
}
