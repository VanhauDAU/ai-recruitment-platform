import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message as toast } from '@/shared/lib/toast'
import { sendConversationMessage } from '../api/conversation.api'
import { conversationKeys } from '../api/conversation.keys'
import { portalRole } from '../lib/connect-paths'
import { applyMessageToList } from './conversation-list'
import { mergeMessages, newClientId, optimisticMessage, patchPendingMessage } from './messages'

/**
 * Send with an optimistic copy: it shows at once as "sending", becomes the
 * server message (same `client_id`) or turns "failed" with a retry that reuses
 * the `client_id`, so a retry never creates a duplicate.
 */
export function useSendMessage(portal, conversationId) {
  const queryClient = useQueryClient()
  const senderRole = portalRole(portal)

  const deliver = useCallback(async (pending) => {
    const threadKey = conversationKeys.messages(portal, conversationId)
    try {
      const saved = await sendConversationMessage(portal, conversationId, { client_id: pending.client_id, ...pending.payload })
      queryClient.setQueryData(threadKey, (thread) => (
        thread ? { ...thread, messages: mergeMessages(thread.messages, [saved]) } : thread
      ))
      queryClient.setQueriesData(
        { queryKey: conversationKeys.lists(portal) },
        (data) => applyMessageToList(data, conversationId, saved, { open: true }) ?? data,
      )
      // `candidate_limit_remaining` and `can_send` may change after any message.
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(portal, conversationId) })
      return saved
    } catch (error) {
      queryClient.setQueryData(threadKey, (thread) => patchPendingMessage(thread, pending.client_id, { status: 'failed' }))
      toast.error(getApiErrorMessage(error, m.connect_send_failed()))
      if (error?.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: conversationKeys.detail(portal, conversationId) })
      }
      return null
    }
  }, [conversationId, portal, queryClient])

  /** `payload`: `{ kind, body }`, `{ kind: 'job', job }`, `{ kind: 'cv', cv }` or `{ file }`. */
  const send = useCallback((payload, preview) => {
    const pending = optimisticMessage({ clientId: newClientId(), payload, preview, senderRole })
    queryClient.setQueryData(conversationKeys.messages(portal, conversationId), (thread) => ({
      messages: mergeMessages(thread?.messages, [pending]),
      hasMore: thread?.hasMore ?? false,
    }))
    return deliver(pending)
  }, [conversationId, deliver, portal, queryClient, senderRole])

  const retry = useCallback((failed) => {
    queryClient.setQueryData(
      conversationKeys.messages(portal, conversationId),
      (thread) => patchPendingMessage(thread, failed.client_id, { status: 'sending' }),
    )
    return deliver(failed)
  }, [conversationId, deliver, portal, queryClient])

  return { send, retry }
}
