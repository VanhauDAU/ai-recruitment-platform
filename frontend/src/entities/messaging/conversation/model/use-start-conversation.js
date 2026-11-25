import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { startConversation } from '../api/conversation.api'
import { conversationKeys } from '../api/conversation.keys'
import { connectPath } from '../lib/connect-paths'

/**
 * Open (or reopen) the conversation for a job, application or invitation, then
 * go to it. `onStarted(conversation)` replaces the default navigation.
 */
export function useStartConversation(portal, { onStarted } = {}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (payload) => startConversation(portal, payload),
    onSuccess: (conversation) => {
      queryClient.setQueryData(conversationKeys.detail(portal, conversation.public_id), conversation)
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists(portal) })
      if (portal === 'candidate') queryClient.invalidateQueries({ queryKey: conversationKeys.appliedJobs() })
      if (onStarted) onStarted(conversation)
      else navigate(connectPath(portal, conversation.public_id))
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.connect_start_failed())),
  })
}
