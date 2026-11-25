import { useQuery } from '@tanstack/react-query'
import { getConversation } from '../api/conversation.api'
import { conversationKeys } from '../api/conversation.keys'
import { mergeMessages } from './messages'

export function useConversation(portal, conversationId) {
  return useQuery({
    queryKey: conversationKeys.detail(portal, conversationId),
    queryFn: () => getConversation(portal, conversationId),
    enabled: Boolean(conversationId),
    retry: (count, error) => count < 2 && ![403, 404].includes(error?.response?.status),
  })
}

/** Put a message the API returned (interview card…) into its cached thread. */
export function storeThreadMessage(queryClient, portal, conversationId, message) {
  if (!message?.seq) return
  queryClient.setQueryData(
    conversationKeys.messages(portal, conversationId),
    (thread) => (thread ? { ...thread, messages: mergeMessages(thread.messages, [message]) } : thread),
  )
}
