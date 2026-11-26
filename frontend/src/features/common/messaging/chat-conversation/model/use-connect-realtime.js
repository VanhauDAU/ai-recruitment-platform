import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  applyIncomingMessage,
  conversationKeys,
  isConversationInView,
  portalRole,
  replaceMessage,
} from '@/entities/messaging/conversation'
import { useRealtimeEvents } from '@/shared/api/use-realtime'
import { applyReadEvent, listsAfterMessage, TYPING_VISIBLE_MS } from './realtime-sync'
import { fillThreadGap } from './thread-sync'

/**
 * Keeps the inbox caches in step with `chat.*` socket events: inserts pushed
 * messages in `seq` order (fetching `after` on a gap), moves list rows, updates
 * "Đã xem" and the typing hint. Toasts come from `useConnectUnreadCount`.
 * Returns the conversation the other side is typing in, if any.
 */
export function useConnectRealtime({ portal, activeId }) {
  const queryClient = useQueryClient()
  // Chỉ giữ id hội thoại trong state; hạn hiển thị nằm ở ref. Bên kia gõ liên tục
  // thì mỗi tín hiệu chỉ gia hạn ref, không vẽ lại cả hộp thư (danh sách, toàn bộ
  // tin nhắn, ô soạn) — trước đây làm ô soạn của mình giật khi hai bên cùng gõ.
  const [typing, setTyping] = useState(null)
  const typingUntilRef = useRef(0)

  useEffect(() => {
    if (!typing) return undefined
    let timer
    const expire = () => {
      const left = typingUntilRef.current - Date.now()
      if (left > 0) timer = window.setTimeout(expire, left)
      else setTyping(null)
    }
    expire()
    return () => window.clearTimeout(timer)
  }, [typing])

  useRealtimeEvents((event) => {
    const conversationId = event.conversation
    const listFilter = { queryKey: conversationKeys.lists(portal) }
    if (event.type === 'connected') {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all(portal) })
      if (activeId) fillThreadGap(queryClient, portal, activeId)
      return
    }
    if (!conversationId) return
    if (event.type === 'chat.message.created' && event.message) {
      const threadKey = conversationKeys.messages(portal, conversationId)
      const { thread, gap } = applyIncomingMessage(queryClient.getQueryData(threadKey), event.message)
      if (gap) fillThreadGap(queryClient, portal, conversationId)
      else if (thread) queryClient.setQueryData(threadKey, thread)
      const { updates, missing } = listsAfterMessage(
        queryClient.getQueriesData(listFilter),
        conversationId,
        event.message,
        { unreadCount: event.unread_count, open: isConversationInView(conversationId) },
      )
      updates.forEach(([key, data]) => queryClient.setQueryData(key, data))
      if (missing) queryClient.invalidateQueries(listFilter)
      // Tin của bên kia có thể mở khóa/giới hạn gửi (NTD trả lời lần đầu).
      if (!event.message.mine) {
        queryClient.invalidateQueries({ queryKey: conversationKeys.detail(portal, conversationId) })
        setTyping((current) => (current === conversationId ? null : current))
      }
      return
    }
    if (event.type === 'chat.message.updated' && event.message) {
      queryClient.setQueryData(
        conversationKeys.messages(portal, conversationId),
        (thread) => replaceMessage(thread, event.message),
      )
      return
    }
    if (event.type === 'chat.read') {
      const detailKey = conversationKeys.detail(portal, conversationId)
      const next = applyReadEvent(
        { detail: queryClient.getQueryData(detailKey), lists: queryClient.getQueriesData(listFilter), myRole: portalRole(portal) },
        event,
      )
      if (next.mine) next.lists.forEach(([key, data]) => data && queryClient.setQueryData(key, data))
      else if (next.detail) queryClient.setQueryData(detailKey, next.detail)
      return
    }
    if (event.type === 'chat.conversation.updated') {
      // Chặn / gỡ chặn: tải lại ngữ cảnh để khung soạn khóa hoặc mở đúng lúc.
      queryClient.invalidateQueries(listFilter)
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(portal, conversationId) })
      return
    }
    if (event.type === 'chat.typing') {
      typingUntilRef.current = Date.now() + TYPING_VISIBLE_MS
      setTyping(conversationId)
    }
  })

  return typing
}
