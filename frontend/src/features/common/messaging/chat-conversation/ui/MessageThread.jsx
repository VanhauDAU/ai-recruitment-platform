import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import { seenMessageSeq, setActiveConversation, systemMessageText, useSendMessage } from '@/entities/messaging/conversation'
import { m } from '@/shared/config/i18n'
import { formatClockTime, formatRelativeDay, localDayKey } from '@/shared/lib/date-time'
import { useIntersection } from '@/shared/hooks/use-intersection'
import { Avatar, Button, Skeleton } from '@/shared/ui/connect-kit'
import { useConversationThread } from '../model/use-conversation-thread'
import { useMarkRead } from '../model/use-mark-read'
import MessageContent, { CARD_KINDS } from './MessageContent'

// Cách đáy dưới ngưỡng này thì tin mới tự cuộn xuống; xa hơn là người dùng đang đọc lại.
const STICK_THRESHOLD_PX = 120

function MessageStatus({ message, seen, onRetry }) {
  if (message.status === 'sending') return <span className="pc-msg__status">{m.connect_message_sending()}</span>
  if (message.status === 'failed') {
    return (
      <span className="pc-msg__status pc-msg__status--failed">
        <ExclamationCircleOutlined aria-hidden /> {m.connect_message_failed()}
        <Button variant="accent" className="pc-msg__retry" onClick={() => onRetry(message)}>{m.connect_retry()}</Button>
      </span>
    )
  }
  return seen ? <span className="pc-msg__status">{m.connect_message_seen()}</span> : null
}

function Welcome({ conversation }) {
  const { counterpart = {}, job = {} } = conversation
  return (
    <div className="pc-welcome">
      <Avatar src={counterpart.avatar_url} name={counterpart.name} size={56} />
      <strong className="pc-welcome__name">{counterpart.name}</strong>
      {job.title && <span className="pc-welcome__text">{job.title}</span>}
      <span className="pc-welcome__text">{m.connect_thread_welcome()}</span>
    </div>
  )
}

/**
 * Message history of one conversation: day separators, bubbles grouped by side,
 * cards by kind, older pages when scrolling up (position kept), "Đã xem" under my
 * last read message. Mount with `key={conversation.public_id}` to reset scroll.
 */
export default function MessageThread({ portal, conversation, typing = false, renderCvActions, renderInterviewActions }) {
  const conversationId = conversation.public_id
  const thread = useConversationThread(portal, conversationId)
  const { retry } = useSendMessage(portal, conversationId)
  const { messages } = thread
  const scrollRef = useRef(null)
  const topRef = useRef(null)
  const stickRef = useRef(true)
  const layoutRef = useRef({ firstSeq: null, lastKey: null, height: 0 })
  const seenSeq = seenMessageSeq(messages, conversation.peer_last_read_seq)

  useMarkRead(portal, conversationId, messages)
  useEffect(() => setActiveConversation(conversationId), [conversationId])
  useIntersection(topRef, thread.loadOlder, { rootRef: scrollRef, enabled: thread.hasMore && !thread.loadingOlder })

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const previous = layoutRef.current
    const first = messages[0]?.seq ?? null
    const last = messages.at(-1)
    const lastKey = last ? last.seq ?? last.client_id : null
    if (previous.firstSeq && first && first < previous.firstSeq && previous.lastKey === lastKey) {
      element.scrollTop += element.scrollHeight - previous.height
    } else if ((lastKey !== previous.lastKey && (stickRef.current || last?.mine)) || (typing && stickRef.current)) {
      element.scrollTop = element.scrollHeight
    }
    layoutRef.current = { firstSeq: first, lastKey, height: element.scrollHeight }
  }, [messages, typing])

  const handleScroll = () => {
    const element = scrollRef.current
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX
  }
  const handleMediaLoad = () => {
    const element = scrollRef.current
    if (element && stickRef.current) element.scrollTop = element.scrollHeight
  }

  const sideOf = (message) => (message.kind === 'system' ? 'system' : message.mine)
  return (
    <div ref={scrollRef} onScroll={handleScroll} className="pc-thread" role="log" aria-label={m.connect_thread_label()}>
      <div className="pc-thread__column">
        <div ref={topRef} className="pc-thread__sentinel" aria-hidden />
        {(thread.isPending || thread.loadingOlder) && <Skeleton rows={3} className="pc-thread__skeleton" />}
        {thread.isError && (
          <div className="pc-note">
            <p>{m.connect_thread_load_failed()}</p>
            <Button variant="accent" onClick={() => thread.refetch()}>{m.connect_retry()}</Button>
          </div>
        )}
        {thread.isSuccess && !messages.some((message) => message.kind !== 'system') && <Welcome conversation={conversation} />}
        <div className="pc-thread__list">
          {messages.map((message, index) => {
            const before = messages[index - 1]
            const newDay = !before || localDayKey(before.created_at) !== localDayKey(message.created_at)
            const grouped = !newDay && sideOf(before) === sideOf(message)
            const key = message.seq ? `s${message.seq}` : `c${message.client_id}`
            const separator = newDay ? <p className="pc-thread__day">{formatRelativeDay(message.created_at)}</p> : null
            if (message.kind === 'system') {
              return (
                <Fragment key={key}>
                  {separator}
                  <p className="pc-msg-system">{systemMessageText(message, conversation.my_role)}</p>
                </Fragment>
              )
            }
            const card = CARD_KINDS.has(message.kind)
            const time = <time className="pc-msg__time" dateTime={message.created_at}>{formatClockTime(message.created_at)}</time>
            const content = (
              <MessageContent
                portal={portal}
                conversationId={conversationId}
                message={message}
                renderCvActions={renderCvActions}
                renderInterviewActions={renderInterviewActions}
                onMediaLoad={handleMediaLoad}
              />
            )
            return (
              <Fragment key={key}>
                {separator}
                <div className={`pc-msg ${message.mine ? 'pc-msg--mine' : 'pc-msg--theirs'}${grouped ? ' pc-msg--grouped' : ''}`}>
                  {card ? (
                    <>
                      {content}
                      {time}
                    </>
                  ) : (
                    <div className={`pc-msg__bubble${message.status === 'failed' ? ' pc-msg__bubble--failed' : ''}`}>
                      <span className="pc-msg__text">{content}</span>
                      {time}
                    </div>
                  )}
                  {message.mine && <MessageStatus message={message} seen={message.seq === seenSeq} onRetry={retry} />}
                </div>
              </Fragment>
            )
          })}
        </div>
        {typing && <p className="pc-thread__typing" aria-live="polite">{m.connect_typing()}</p>}
      </div>
    </div>
  )
}
