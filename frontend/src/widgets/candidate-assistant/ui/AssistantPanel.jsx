import { AudioMutedOutlined, CloseOutlined, SendOutlined, SoundOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLoginPrompt } from '@/features/auth'
import { useSession } from '@/entities/session'
import { useSiteSettings } from '@/entities/site-settings'
import { message } from '@/shared/lib/toast'
import { ProcvMascot } from '@/shared/ui/mascot'
import { ASSISTANT_ACTIONS } from '../model/assistant-script'
import { useAssistantScript } from '../model/use-assistant-script'
import { useAssistantVoice } from '../model/use-assistant-voice'
import AssistantMessage from './AssistantMessage'
import '../candidate-assistant.css'

const QUICK_ACTIONS = ['findJobs', 'createCv', 'savedJobs']

export default function AssistantPanel({ onClose }) {
  const navigate = useNavigate()
  const { promptLogin } = useLoginPrompt()
  const { isAuthenticated } = useSession()
  const { settings } = useSiteSettings()
  const { emotion, messages, sendMessage, typing } = useAssistantScript()
  const voice = useAssistantVoice(messages)
  const [input, setInput] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const keepLatestMessageVisible = useCallback(() => {
    const list = listRef.current
    if (!list) return
    if (typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight, behavior: 'auto' })
    } else {
      list.scrollTop = list.scrollHeight
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  function runAction(actionId) {
    const action = ASSISTANT_ACTIONS[actionId]
    if (!action) return
    if (action.kind === 'zalo') {
      if (settings.contact_zalo_url) window.open(settings.contact_zalo_url, '_blank', 'noopener,noreferrer')
      else message.info('Kênh Zalo chưa được cấu hình.')
      return
    }
    if (action.kind === 'hotline') {
      if (settings.hotline) window.location.href = `tel:${String(settings.hotline).replace(/\s/g, '')}`
      else message.info('Hotline chưa được cấu hình.')
      return
    }
    onClose()
    if (action.requiresLoginPrompt && !isAuthenticated) promptLogin(() => navigate(action.to))
    else navigate(action.to)
  }

  function submit(event) {
    event.preventDefault()
    // Web Audio chỉ mở được trong cử chỉ này; câu trả lời về sau mới đọc được.
    voice.prepare()
    if (sendMessage(input)) setInput('')
  }

  return (
    <section
      id="candidate-assistant-panel"
      role="dialog"
      aria-label="Trợ lý ProCV"
      aria-modal="false"
      className="assistant-panel"
    >
      <header className="assistant-panel__header">
        <span className="assistant-panel__avatar">
          <ProcvMascot size={43} emotion={emotion} blink talking={typing || voice.speaking} />
        </span>
        <div className="assistant-panel__identity">
          <h2 className="assistant-panel__title">Trợ lý ProCV</h2>
          <p className="assistant-panel__status">
            <span className="assistant-panel__status-dot" />
            {typing ? 'Đang soạn câu trả lời…' : voice.speaking ? 'Đang đọc câu trả lời…' : 'Sẵn sàng hỗ trợ bạn'}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={voice.enabled}
          aria-label={voice.enabled ? 'Tắt giọng đọc trợ lý' : 'Bật giọng đọc trợ lý'}
          onClick={voice.toggle}
          className="assistant-panel__close"
        >
          {voice.enabled ? <SoundOutlined /> : <AudioMutedOutlined />}
        </button>
        <button type="button" aria-label="Đóng trợ lý" onClick={onClose} className="assistant-panel__close">
          <CloseOutlined />
        </button>
      </header>

      <div ref={listRef} aria-live="polite" className="assistant-panel__messages">
        {messages.map((item) => (
          <AssistantMessage
            key={item.id}
            {...item}
            actions={(item.actions || []).map((actionId) => ({ id: actionId, ...ASSISTANT_ACTIONS[actionId] })).filter((action) => action.label)}
            onAction={runAction}
            onContentProgress={keepLatestMessageVisible}
            speech={{
              active: item.id === voice.activeMessageId,
              elapsed: voice.elapsed,
              enabled: voice.enabled,
              status: voice.status,
            }}
          />
        ))}
        {typing && (
          <div className="assistant-typing" role="status" aria-label="Trợ lý đang trả lời">
            <span className="assistant-message__avatar">
              <ProcvMascot size={29} emotion="thinking" talking />
            </span>
            <span className="assistant-typing__dots">
              {[0, 1, 2].map((dot) => <span key={dot} className="assistant-chat-dot" style={{ animationDelay: `${dot * 0.16}s` }} />)}
            </span>
          </div>
        )}
      </div>

      <div className="assistant-panel__composer">
        <div className="assistant-quick-actions">
          {QUICK_ACTIONS.map((actionId) => (
            <button key={actionId} type="button" onClick={() => runAction(actionId)} className="assistant-quick-actions__button">
              {ASSISTANT_ACTIONS[actionId].label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="assistant-composer-form">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={typing}
            aria-label="Nhập câu hỏi cho trợ lý"
            placeholder="Nhập câu hỏi của bạn…"
            className="assistant-composer-form__input"
          />
          <button type="submit" disabled={!input.trim() || typing} aria-label="Gửi câu hỏi" className="assistant-composer-form__send">
            <SendOutlined />
          </button>
        </form>
        <p className="assistant-disclaimer">
          Trợ lý đang trong giai đoạn thử nghiệm, câu trả lời là mẫu có sẵn.
        </p>
      </div>
    </section>
  )
}
