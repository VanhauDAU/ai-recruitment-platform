import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applicationKeys,
  createApplicationReviewLink,
  getApplicationReviewLinks,
  revokeApplicationReviewLink,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

export default function useReviewLinks(publicId, { enabled }) {
  const queryClient = useQueryClient()
  const queryKey = applicationKeys.reviewLinks(publicId)
  const linksQuery = useQuery({
    queryKey,
    queryFn: () => getApplicationReviewLinks(publicId),
    enabled: enabled && Boolean(publicId),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const createMutation = useMutation({
    mutationFn: (payload) => createApplicationReviewLink(publicId, payload),
    onSuccess: refresh,
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tạo link mời đánh giá.')),
  })
  const revokeMutation = useMutation({
    mutationFn: (linkId) => revokeApplicationReviewLink(publicId, linkId),
    onSuccess: () => {
      refresh()
      message.success('Đã thu hồi link. Người nhận không thể mở hồ sơ nữa.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể thu hồi link.')),
  })
  return { linksQuery, createMutation, revokeMutation }
}
