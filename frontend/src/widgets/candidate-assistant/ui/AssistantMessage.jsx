import { ReloadOutlined, SoundOutlined, StopOutlined } from '@ant-design/icons'
import { useLayoutEffect } from 'react'
import { ProcvMascot } from '@/shared/ui/mascot'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useProgressiveReply } from '@/shared/hooks/use-progressive-reply'

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
  const speechActive = Boolean(speech?.active)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const reveal = useProgressiveReply({
    active: assistant && progressive,
    elapsed: 0,
    enabled: false,
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
        {assistant && (actions.length > 0 || speech?.available) && reveal.complete && (
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
            {speech?.available && (
              <button
                type="button"
                onClick={speech.onToggle}
                aria-label={speechActive && speech.speaking ? 'Dừng đọc tin nhắn' : 'Nghe tin nhắn'}
                className="assistant-message__action"
              >
                {speechActive && speech.speaking
                  ? <StopOutlined />
                  : speechActive && speech.status === 'ended'
                    ? <ReloadOutlined />
                    : <SoundOutlined />}
                {speechActive && speech.speaking
                  ? 'Dừng'
                  : speechActive && speech.status === 'ended' ? 'Phát lại' : 'Nghe'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
