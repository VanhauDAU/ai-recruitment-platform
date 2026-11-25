// Bộ giảm thuần cho sự kiện chat.* — tách khỏi hook để kiểm thử không cần socket.
import { applyMessageToList, markListConversationRead } from '@/entities/messaging/conversation'

/**
 * New list caches after `message` arrives in `conversationId`. `entries` are
 * `[queryKey, data]` pairs of every cached list (one per search term);
 * `missing` is true when the unfiltered list lacks the conversation.
 */
export function listsAfterMessage(entries, conversationId, message, { unreadCount, open = false } = {}) {
  const updates = []
  let missing = false
  for (const [key, data] of entries) {
    if (!data) continue
    const next = applyMessageToList(data, conversationId, message, { unreadCount, open })
    if (next) updates.push([key, next])
    else if (!key[3]) missing = true
  }
  return { updates, missing }
}

/** My read in another tab clears the row; the other side's read moves "Đã xem". */
export function applyReadEvent({ detail, lists = [], myRole }, event) {
  if (event.role === myRole) {
    return {
      mine: true,
      detail,
      lists: lists.map(([key, data]) => [key, data && markListConversationRead(data, event.conversation)]),
    }
  }
  if (!detail) return { mine: false, detail, lists }
  const seq = Math.max(detail.peer_last_read_seq || 0, event.last_read_seq || 0)
  return { mine: false, detail: seq === detail.peer_last_read_seq ? detail : { ...detail, peer_last_read_seq: seq }, lists }
}

export const TYPING_VISIBLE_MS = 5_000
export const TYPING_SEND_INTERVAL_MS = 3_000

/** Whether a keystroke may send another `typing` signal (at most one per 3s). */
export function shouldSendTyping(lastSentAt, now = Date.now()) {
  return !lastSentAt || now - lastSentAt >= TYPING_SEND_INTERVAL_MS
}
