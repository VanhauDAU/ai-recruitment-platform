import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCandidateAudience } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { followCompany, getCompanyFollow, unfollowCompany } from '../api/follow-company.api'
import { followCompanyKeys } from '../api/follow-company.keys'
import { restoreFollowCaches, snapshotFollowCaches, writeFollowSurfaces } from './follow-cache'

/**
 * Trạng thái theo dõi một công ty của ứng viên đang đăng nhập; khách và vai trò
 * khác không phát request đọc. `knownStatus` là trạng thái đã có sẵn trong một
 * dòng của danh sách "đang theo dõi", khi đó hook không tải lại từng công ty.
 *
 * Mọi thay đổi được áp ngay vào cache (lạc quan), hoàn tác khi máy chủ từ chối
 * và thay bằng số liệu máy chủ khi thành công.
 */
export function useCompanyFollow(publicId, knownStatus) {
  const queryClient = useQueryClient()
  const isCandidate = useCandidateAudience() === 'candidate'
  const queryKey = followCompanyKeys.status(publicId)
  const statusQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getCompanyFollow(publicId, { signal }),
    enabled: isCandidate && Boolean(publicId) && !knownStatus,
  })
  const status = knownStatus ?? statusQuery.data
  const following = Boolean(status?.following)

  const mutation = useMutation({
    mutationFn: (next) => (next.following
      ? followCompany(publicId, next.notify_new_jobs === undefined ? {} : { notify_new_jobs: next.notify_new_jobs })
      : unfollowCompany(publicId)),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey })
      const snapshot = snapshotFollowCaches(queryClient, publicId)
      const delta = Number(next.following) - Number(following)
      const followerCount = (count) => Math.max(0, (Number(count) || 0) + delta)
      // Lần theo dõi đầu tiên mặc định nhận email việc làm mới.
      const optimistic = {
        following: next.following,
        notify_new_jobs: next.following && (next.notify_new_jobs ?? true),
      }
      queryClient.setQueryData(queryKey, (current) => current && {
        ...optimistic,
        follower_count: followerCount(current.follower_count),
      })
      writeFollowSurfaces(queryClient, publicId, optimistic, followerCount)
      return snapshot
    },
    onError: (error, _next, snapshot) => {
      restoreFollowCaches(queryClient, snapshot)
      message.error(error?.response?.status === 404
        ? 'Trang công ty này không còn được hiển thị.'
        : getApiErrorMessage(error, 'Chưa thể cập nhật theo dõi công ty. Vui lòng thử lại.'))
    },
    onSuccess: (serverStatus) => {
      queryClient.setQueryData(queryKey, serverStatus)
      writeFollowSurfaces(queryClient, publicId, serverStatus, () => serverStatus.follower_count)
      queryClient.invalidateQueries({ queryKey: followCompanyKeys.followedLists })
    },
  })

  return {
    following,
    notifyNewJobs: Boolean(status?.notify_new_jobs),
    // Ứng viên chưa có trạng thái thì nút chưa biết nên theo dõi hay bỏ theo dõi.
    isLoading: statusQuery.isLoading,
    isPending: mutation.isPending,
    setFollowing: (next) => mutation.mutate({ following: next }),
    setNotifyNewJobs: (notifyNewJobs) => mutation.mutate({ following: true, notify_new_jobs: notifyNewJobs }),
  }
}
