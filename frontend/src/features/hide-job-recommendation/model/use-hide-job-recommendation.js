import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { jobKeys } from '@/entities/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { hideJobRecommendation, restoreJobRecommendation } from '../api/hidden-job.api'

export function useHideJobRecommendation() {
  const queryClient = useQueryClient()
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [pendingIds, setPendingIds] = useState(() => new Set())

  const invalidateRecommendations = useCallback(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: jobKeys.candidateRecommendationsRoot }),
    queryClient.invalidateQueries({ queryKey: jobKeys.inlineRecommendationsRoot }),
  ]), [queryClient])

  const restoreMutation = useMutation({
    mutationFn: restoreJobRecommendation,
    onSuccess: (_data, publicId) => {
      setHiddenIds((current) => {
        const next = new Set(current)
        next.delete(publicId)
        return next
      })
      void invalidateRecommendations()
      message.success('Đã hoàn tác ẩn tin tuyển dụng.')
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể hoàn tác. Vui lòng thử lại.'))
    },
  })

  const hideMutation = useMutation({
    mutationFn: ({ publicId, source }) => hideJobRecommendation(publicId, source),
  })

  const hide = useCallback(async (job, source) => {
    const publicId = job.public_id
    if (!publicId || pendingIds.has(publicId)) return

    setHiddenIds((current) => new Set(current).add(publicId))
    setPendingIds((current) => new Set(current).add(publicId))
    try {
      await hideMutation.mutateAsync({ publicId, source })
      void invalidateRecommendations()
      message.success('Đã ẩn tin tuyển dụng này.', {
        action: {
          label: 'Hoàn tác',
          onClick: () => restoreMutation.mutate(publicId),
        },
      })
    } catch (error) {
      setHiddenIds((current) => {
        const next = new Set(current)
        next.delete(publicId)
        return next
      })
      message.error(getApiErrorMessage(error, 'Không thể ẩn tin tuyển dụng. Vui lòng thử lại.'))
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(publicId)
        return next
      })
    }
  }, [hideMutation, invalidateRecommendations, pendingIds, restoreMutation])

  return {
    hiddenIds,
    pendingIds,
    hide,
    restoring: restoreMutation.isPending,
  }
}
