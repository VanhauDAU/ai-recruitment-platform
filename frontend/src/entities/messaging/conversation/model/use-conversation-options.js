import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearConversation, setConversationBlocked } from '../api/conversation.api'
import { conversationKeys } from '../api/conversation.keys'

/** Xóa phía mình và chặn/gỡ chặn một hội thoại; làm mới danh sách, ngữ cảnh, badge. */
export function useConversationOptions(portal, conversationId) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.all(portal) })
    queryClient.invalidateQueries({ queryKey: conversationKeys.messages(portal, conversationId) })
  }
  const clear = useMutation({ mutationFn: () => clearConversation(portal, conversationId), onSuccess: refresh })
  const block = useMutation({
    mutationFn: (blocked) => setConversationBlocked(portal, conversationId, blocked),
    onSuccess: (conversation) => {
      queryClient.setQueryData(conversationKeys.detail(portal, conversationId), conversation)
      refresh()
    },
  })
  return { clear, block }
}
