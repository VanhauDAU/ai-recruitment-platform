import { useEffect, useLayoutEffect } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useProgressiveReply } from '@/shared/hooks/use-progressive-reply'
import { ProcvMascot } from '@/shared/ui/mascot'
import '../onboarding-interview.css'

const BUBBLE_CLASS = 'onboarding-chat__bubble'

/**
 * Tin nhắn mới nhất của robot hiện dần theo typewriter; tin nhắn cũ hiện nguyên
 * văn ngay.
 */
function BotMessage({ emotion, live, message, onContentProgress, onRevealed }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const reveal = useProgressiveReply({
    active: live,
    progressive: live,
    reducedMotion,
    text: message.text,
  })

  useEffect(() => {
    if (live && reveal.complete) onRevealed?.(message.id)
  }, [live, message.id, onRevealed, reveal.complete])

  // Chạy trước khi browser paint để bong bóng đang cao dần luôn nằm trong tầm
  // nhìn, không để thấy một frame bị tụt rồi mới cuộn xuống.
  useLayoutEffect(() => {
    if (live) onContentProgress?.()
  }, [live, onContentProgress, reveal.text])

  return (
    <div className="flex items-end gap-2">
      <span className="mb-0.5 shrink-0">
        <ProcvMascot blink emotion={emotion} size={38} talking={live && reveal.typing} />
      </span>
      <div className={`${BUBBLE_CLASS} rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm`}>
        <span className="onboarding-chat__sr">{message.text}</span>
        <span aria-hidden="true">
          {reveal.text}
          {reveal.typing && <span className="onboarding-chat__caret" />}
        </span>
        {message.kind === 'saving' && (
          <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-slate-200">
            <span className="onboarding-chat__progress block h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" />
          </span>
        )}
      </div>
    </div>
  )
}

/** Đáp án của ứng viên, kèm lối sửa lại tại chỗ thay cho nút "Quay lại". */
function UserMessage({ message, onEdit }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`${BUBBLE_CLASS} rounded-br-md bg-emerald-600 text-white shadow-sm shadow-emerald-900/20`}>
        {message.text}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(message.stepId)}
          className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700"
        >
          Sửa
        </button>
      )}
    </div>
  )
}

export default function ChatMessage({ emotion, live, message, onContentProgress, onEdit, onRevealed }) {
  if (message.role === 'user') return <UserMessage message={message} onEdit={onEdit} />
  return (
    <BotMessage
      emotion={emotion}
      live={live}
      message={message}
      onContentProgress={onContentProgress}
      onRevealed={onRevealed}
    />
  )
}
