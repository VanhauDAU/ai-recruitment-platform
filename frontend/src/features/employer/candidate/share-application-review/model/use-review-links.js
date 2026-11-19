import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applicationKeys,
  createApplicationReviewLink,
  getApplicationReviewLinks,
  revokeApplicationReviewLink,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

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
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_share_create_error())),
  })
  const revokeMutation = useMutation({
    mutationFn: (linkId) => revokeApplicationReviewLink(publicId, linkId),
    onSuccess: () => {
      refresh()
      message.success(m.employer_workspace_share_revoked())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_share_revoke_error())),
  })
  return { linksQuery, createMutation, revokeMutation }
}
