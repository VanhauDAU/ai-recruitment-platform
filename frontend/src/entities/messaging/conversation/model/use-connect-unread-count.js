import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useRealtimeEvents, useRealtimeOpen } from '@/shared/api/use-realtime'
import { m } from '@/shared/config/i18n'
import { announceNotice } from '@/shared/lib/incoming-notice'
import { getConversationUnreadCount } from '../api/conversation.api'
import { conversationKeys } from '../api/conversation.keys'
import { connectPath } from '../lib/connect-paths'
import { messagePreview } from '../lib/message-labels'
import { isConversationInView } from './active-conversation'
import { findCachedConversation } from './conversation-list'

// Fallback khi socket đóng (mạng chặn WebSocket, server realtime bảo trì).
const FALLBACK_POLL_MS = 60_000
const TOAST_PREVIEW_CHARS = 80
const BADGE_EVENTS = new Set(['chat.message.created', 'chat.read'])

function counterpartName(queryClient, portal, conversationId) {
  for (const [, data] of queryClient.getQueriesData({ queryKey: conversationKeys.lists(portal) })) {
    const conversation = findCachedConversation(data, conversationId)
    if (conversation) return conversation.counterpart?.name || ''
  }
  return queryClient.getQueryData(conversationKeys.detail(portal, conversationId))?.counterpart?.name || ''
}

/**
 * Number of conversations with unread messages, for the header/sidebar badge.
 * Also the one place that toasts (with the message sound) for an incoming message,
 * except for the conversation the user is looking at; `announceNotice` keeps it
 * to one tab and one toast per message.
 */
export function useConnectUnreadCount(portal, { enabled = true } = {}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const live = useRealtimeOpen()
  const query = useQuery({
    queryKey: conversationKeys.unread(portal),
    queryFn: () => getConversationUnreadCount(portal),
    enabled,
    refetchInterval: live ? false : FALLBACK_POLL_MS,
  })

  useRealtimeEvents((event) => {
    if (event.type !== 'connected' && !BADGE_EVENTS.has(event.type)) return
    queryClient.invalidateQueries({ queryKey: conversationKeys.unread(portal) })
    const incoming = event.type === 'chat.message.created' ? event.message : null
    if (!incoming || incoming.mine || incoming.kind === 'system' || isConversationInView(event.conversation)) return
    const name = counterpartName(queryClient, portal, event.conversation)
    const preview = messagePreview(incoming)
    const text = preview.length > TOAST_PREVIEW_CHARS ? `${preview.slice(0, TOAST_PREVIEW_CHARS)}…` : preview
    announceNotice({
      id: incoming.public_id,
      title: name ? m.connect_toast_message({ name, text }) : m.connect_toast_message_generic({ text }),
      path: connectPath(portal, event.conversation),
      onOpen: navigate,
      sound: 'message',
    })
  }, { enabled })

  return query.data?.count || 0
}
