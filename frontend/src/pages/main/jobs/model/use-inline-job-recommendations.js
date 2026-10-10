import { useQuery } from '@tanstack/react-query'
import { getInlineJobRecommendations, jobKeys } from '@/entities/job'

export default function useInlineJobRecommendations({
  enabled,
  excludedJobIds,
  page,
  rankingSeed,
}) {
  const excluded = excludedJobIds.join(',')
  const params = { page, ranking_seed: rankingSeed, excluded }
  const query = useQuery({
    queryKey: jobKeys.inlineRecommendations(params),
    queryFn: () => getInlineJobRecommendations({
      page,
      ranking_seed: rankingSeed,
      excludedJobIds,
    }),
    enabled: Boolean(enabled && rankingSeed && excludedJobIds.length),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const data = query.data
  return {
    afterResultIndex: data?.after_result_index ?? null,
    results: data?.status === 'ready' ? data.results || [] : [],
  }
}
