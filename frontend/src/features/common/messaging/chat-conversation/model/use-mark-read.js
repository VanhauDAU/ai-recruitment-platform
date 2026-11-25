import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import {
  conversationKeys,
  lastPeerSeq,
  lastSeq,
  markConversationRead,
  markListConversationRead,
} from '@/entities/messaging/conversation'

const isLooking = () => document.visibilityState === 'visible' && document.hasFocus()

/**
 * Report the highest loaded `seq` as read while the thread is on screen and the
 * window has focus; re-checks when the user comes back to the tab.
 */
export function useMarkRead(portal, conversationId, messages) {
  const queryClient = useQueryClient()
  const sentRef = useRef(0)
  const peerSeq = lastPeerSeq(messages)
  const newestSeq = lastSeq(messages)

  useEffect(() => {
    if (!conversationId || !peerSeq) return undefined
    const markRead = () => {
      if (!isLooking() || sentRef.current >= peerSeq) return
      const sent = newestSeq
      sentRef.current = sent
      markConversationRead(portal, conversationId, sent)
        .then(() => {
          queryClient.setQueriesData(
            { queryKey: conversationKeys.lists(portal) },
            (data) => data && markListConversationRead(data, conversationId),
          )
          queryClient.invalidateQueries({ queryKey: conversationKeys.unread(portal) })
        })
        .catch(() => {
          if (sentRef.current === sent) sentRef.current = 0
        })
    }
    markRead()
    window.addEventListener('focus', markRead)
    document.addEventListener('visibilitychange', markRead)
    return () => {
      window.removeEventListener('focus', markRead)
      document.removeEventListener('visibilitychange', markRead)
    }
  }, [conversationId, newestSeq, peerSeq, portal, queryClient])
}
