import { useLayoutEffect } from 'react'
import { ProcvMascot } from '@/shared/ui/mascot'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useProgressiveReply } from '../model/use-progressive-reply'

export default function AssistantMessage({
  actions = [],
  from,
  onAction,
  onContentProgress,
  progressive = false,
  speech,
  text,
}) {
  const assistant = from === 'assistant'
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const reveal = useProgressiveReply({
    active: Boolean(speech?.active),
    elapsed: speech?.elapsed,
    enabled: speech?.enabled,
    progressive: assistant && progressive,
    reducedMotion,
    status: speech?.status,
    text,
  })

  // Chạy trước khi browser paint để bubble đang cao dần luôn nằm trong viewport,
  // không để người dùng thấy một frame bị tụt rồi mới cuộn xuống.
  useLayoutEffect(() => {
    if (assistant && progressive) onContentProgress?.()
  }, [assistant, onContentProgress, progressive, reveal.complete, reveal.text])

  return (
    <div className={`assistant-message ${assistant ? 'assistant-message--bot' : 'assistant-message--user'}`}>
      {assistant && (
        <span className="assistant-message__avatar">
          <ProcvMascot size={29} emotion="happy" />
        </span>
      )}
      <div className="assistant-message__wrap">
        <div
          className={`assistant-message__bubble assistant-message-in ${assistant
            ? 'assistant-message__bubble--bot'
            : 'assistant-message__bubble--user'
          }`}
        >
          {assistant && progressive ? (
            <>
              <span className="assistant-message__accessible-text">{text}</span>
              <span aria-hidden="true">
                {reveal.text}
                {reveal.typing && <span className="assistant-message__caret" />}
              </span>
            </>
          ) : text}
        </div>
        {assistant && actions.length > 0 && reveal.complete && (
          <div className="assistant-message__actions assistant-message__actions--ready">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.id)}
                className="assistant-message__action"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
