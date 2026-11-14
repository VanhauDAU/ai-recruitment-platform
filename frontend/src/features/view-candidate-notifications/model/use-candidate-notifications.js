import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  candidateNotificationKeys,
  getCandidateNotifications,
  getCandidateNotificationUnreadCount,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
} from '@/entities/candidate-notification'

/** Badge polls cheaply; the list is fetched only while the panel is open. */
export default function useCandidateNotifications({ open }) {
  const queryClient = useQueryClient()
  const unreadQuery = useQuery({
    queryKey: candidateNotificationKeys.unread(),
    queryFn: getCandidateNotificationUnreadCount,
    refetchInterval: 60_000,
  })
  const listQuery = useQuery({
    queryKey: candidateNotificationKeys.list(1),
    queryFn: () => getCandidateNotifications(1),
    enabled: open,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: candidateNotificationKeys.all })
  const readMutation = useMutation({ mutationFn: (publicId) => markCandidateNotificationRead(publicId), onSuccess: refresh })
  const readAllMutation = useMutation({ mutationFn: () => markAllCandidateNotificationsRead(), onSuccess: refresh })

  return {
    unreadCount: unreadQuery.data?.count || 0,
    items: listQuery.data?.results?.slice(0, 8) || [],
    isPending: listQuery.isPending,
    isError: listQuery.isError,
    markRead: (item) => !item.is_read && readMutation.mutate(item.public_id),
    markAllRead: () => readAllMutation.mutate(),
    markingAll: readAllMutation.isPending,
  }
}
