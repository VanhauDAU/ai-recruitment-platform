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
}) {
  onStatus('creating')
  const session = await createBlogSpeechSession({ sourcePublicId, signal })
  if (signal.aborted) return

  const config = {
    cached: Boolean(session.cached),
    style: session.style,
    voiceId: session.voice_id,
  }
  onSession(session, config)

  await playSpeechStream({ onQueued, onStatus, player, rate, session, signal })
}
