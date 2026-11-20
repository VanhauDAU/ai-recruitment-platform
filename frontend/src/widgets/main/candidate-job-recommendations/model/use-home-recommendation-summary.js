import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/entities/account/session'
import { getCandidateJobRecommendations, jobKeys } from '@/entities/job/job'

export const HOME_RECOMMENDATION_PARAMS = Object.freeze({ page: 1, page_size: 8 })
export const MATCHING_PATH = '/tai-khoan/viec-lam-phu-hop'

/** Query gợi ý của khối trang chủ; dùng chung key nên banner và khối gợi ý chỉ gọi API một lần. */
export function useHomeRecommendationQuery() {
  const { isAuthenticated, user } = useSession()
  const enabled = Boolean(isAuthenticated && user?.role === 'candidate')
  const query = useQuery({
    queryKey: jobKeys.candidateRecommendations(HOME_RECOMMENDATION_PARAMS),
    queryFn: () => getCandidateJobRecommendations(HOME_RECOMMENDATION_PARAMS),
    enabled,
    retry: 1,
  })
  return { enabled, query }
}

/** `{ status, total, href }` cho slide AI; `null` với khách hoặc khi AI gợi ý đang tắt. */
export function useHomeRecommendationSummary() {
  const { enabled, query } = useHomeRecommendationQuery()
  const data = query.data
  if (!enabled || !data || data.ai_recommendation_enabled === false) return null
  return { status: data.status, total: data.pagination?.total ?? 0, href: MATCHING_PATH }
}
