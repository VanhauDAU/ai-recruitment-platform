import { useEffect, useRef } from 'react'
import { AudioMutedOutlined, RedoOutlined, SoundOutlined } from '@ant-design/icons'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useProgressiveReply } from '@/shared/hooks/use-progressive-reply'
import { ProcvMascot } from '@/shared/ui/mascot'
import { useOnboardingVoice } from '../model/onboarding-voice-context'
import '../onboarding-interview.css'

const ICON_BUTTON_CLASS = 'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Robot dẫn chuyện + bong bóng thoại. Câu trong bong bóng chính là câu robot
 * đọc, hiện dần theo tiến độ audio; tắt tiếng hoặc audio lỗi thì
 * `useProgressiveReply` tự rơi về typewriter nên chữ không bao giờ kẹt.
 */
export default function InterviewMascot({
  autoSpeak = true,
  emotion = 'neutral',
  float = false,
  onSpoken,
  pose = 'neutral',
  speech = '',
  speechId,
}) {
  const { elapsed, enabled, replay, speakOnce, speaking, status, toggle } = useOnboardingVoice()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const compact = !useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (autoSpeak) speakOnce(speechId, speech)
  }, [autoSpeak, speakOnce, speech, speechId])

  const reveal = useProgressiveReply({
    active: true,
    elapsed,
    enabled,
    progressive: true,
    reducedMotion,
    status,
    text: speech,
  })

  // "Nói xong" = phụ đề chạy hết VÀ audio không còn chạy. Phải chờ đã từng phát
  // (hoặc chắc chắn sẽ không phát) mới tính, nếu không lần render đầu khi chưa
  // kịp gửi request sẽ bị hiểu nhầm là đã nói xong.
  const spokeRef = useRef(false)
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (speaking) spokeRef.current = true
  }, [speaking])

  useEffect(() => {
    if (!onSpoken || notifiedRef.current) return
    if (!reveal.complete || speaking) return
    if (!spokeRef.current && enabled && status !== 'error') return
    notifiedRef.current = true
    onSpoken()
  }, [enabled, onSpoken, reveal.complete, speaking, status])

  return (
    <div className="onboarding-stage">
      <ProcvMascot
        blink
        emotion={emotion}
        float={float}
        pose={pose}
        shadow="floating"
        size={compact ? 104 : 156}
        talking={speaking}
      />
      <div className="onboarding-stage__bubble">
        <span className="onboarding-stage__sr">{speech}</span>
        <span aria-hidden="true">
          {reveal.text}
          {reveal.typing && <span className="onboarding-stage__caret" />}
        </span>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1 lg:justify-start">
          <button
            type="button"
            aria-label={enabled ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
            aria-pressed={enabled}
            onClick={toggle}
            className={ICON_BUTTON_CLASS}
          >
            {enabled ? <SoundOutlined /> : <AudioMutedOutlined />}
          </button>
          {enabled && (
            <button
              type="button"
              aria-label="Nghe lại"
              disabled={speaking}
              onClick={() => replay(speechId, speech)}
              className={ICON_BUTTON_CLASS}
            >
              <RedoOutlined />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
