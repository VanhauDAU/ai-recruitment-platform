import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AI_RECOMMENDATION_QUERY_KEY, getAiRecommendation, updateAiRecommendation,
} from '@/entities/job/candidate-preferences'
import { jobKeys } from '@/entities/job/job'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

/**
 * Đồng ý gợi ý việc làm bằng AI (AI_RECOMMENDATION). Đổi xong thì làm mới danh sách
 * gợi ý: tắt vẫn có danh sách, nhưng không đọc CV.
 */
export function useAiRecommendation({ source = 'account_sidebar' } = {}) {
  const queryClient = useQueryClient()
  const consent = useQuery({ queryKey: AI_RECOMMENDATION_QUERY_KEY, queryFn: getAiRecommendation })
  const mutation = useMutation({
    mutationFn: (enabled) => updateAiRecommendation({
      enabled,
      source,
      source_path: window.location.pathname,
    }),
    onSuccess: (saved) => {
      queryClient.setQueryData(AI_RECOMMENDATION_QUERY_KEY, saved)
      queryClient.invalidateQueries({ queryKey: jobKeys.candidateRecommendationsRoot })
      message.success(saved.enabled ? m.candidate_reco_toggle_on() : m.candidate_reco_toggle_off())
    },
    onError: () => message.error(m.candidate_reco_toggle_failed()),
  })

  return {
    enabled: Boolean(consent.data?.enabled),
    loading: consent.isPending,
    saving: mutation.isPending,
    setEnabled: (enabled) => mutation.mutateAsync(enabled),
  }
}
