import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  conversationKeys,
  firstSeq,
  getConversationMessages,
  prependOlder,
  reconcileLatest,
} from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message as toast } from '@/shared/lib/toast'

/**
 * Messages of one conversation, newest page first, older pages on demand.
 * Every mount reloads the newest page and merges it with the cache, so a thread
 * reopened later never misses messages; socket events keep it live meanwhile.
 */
export function useConversationThread(portal, conversationId) {
  const queryClient = useQueryClient()
  const [loadingOlder, setLoadingOlder] = useState(false)
  const query = useQuery({
    queryKey: conversationKeys.messages(portal, conversationId),
    queryFn: async () => reconcileLatest(
      queryClient.getQueryData(conversationKeys.messages(portal, conversationId)),
      await getConversationMessages(portal, conversationId),
    ),
    enabled: Boolean(conversationId),
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const loadOlder = useCallback(async () => {
    const key = conversationKeys.messages(portal, conversationId)
    const thread = queryClient.getQueryData(key)
    if (!thread?.hasMore || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await getConversationMessages(portal, conversationId, { before: firstSeq(thread.messages) })
      queryClient.setQueryData(key, (current) => prependOlder(current, page))
    } catch (error) {
      toast.error(getApiErrorMessage(error, m.connect_thread_load_failed()))
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, loadingOlder, portal, queryClient])

  return {
    messages: query.data?.messages || [],
    hasMore: Boolean(query.data?.hasMore),
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    refetch: query.refetch,
    loadOlder,
    loadingOlder,
  }
}
