import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { applicationKeys } from '@/entities/application/application'
import {
  candidateNotificationKeys,
  getCandidateNotifications,
  getCandidateNotificationUnreadCount,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
} from '@/entities/notification/candidate-notification'
import { useRealtimeEvents, useRealtimeOpen } from '@/shared/api/use-realtime'
import { announceNotice } from '@/shared/lib/incoming-notice'

// Fallback khi socket đóng (mạng chặn WebSocket, server realtime bảo trì).
const FALLBACK_POLL_MS = 60_000

/**
 * Badge cập nhật qua WebSocket, polling chỉ là dự phòng; danh sách chỉ tải
 * khi mở panel. Socket chỉ báo "có thay đổi": nội dung luôn lấy lại qua REST.
 */
export default function useCandidateNotifications({ open }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const live = useRealtimeOpen()
  const unreadQuery = useQuery({
    queryKey: candidateNotificationKeys.unread(),
    queryFn: getCandidateNotificationUnreadCount,
    refetchInterval: live ? false : FALLBACK_POLL_MS,
  })
  const listQuery = useQuery({
    queryKey: candidateNotificationKeys.list(1),
    queryFn: () => getCandidateNotifications(1),
    enabled: open,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: candidateNotificationKeys.all })

  useRealtimeEvents((event) => {
    if (event.type === 'connected') {
      refresh()
      return
    }
    if (event.scope !== 'candidate') return
    refresh()
    if (event.type !== 'notification.created') return
    // Quyết định của nhà tuyển dụng đổi luôn trạng thái ở "Việc làm đã ứng tuyển".
    queryClient.invalidateQueries({ queryKey: applicationKeys.candidateList })
    const notice = event.notification || {}
    announceNotice({ id: notice.public_id, title: notice.title, path: notice.action_path, onOpen: navigate })
  })

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
