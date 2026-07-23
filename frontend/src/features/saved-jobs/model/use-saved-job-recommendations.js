import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/entities/session'
import { getSavedJobRecommendations } from '../api/saved-jobs.api'
import { savedJobsKeys } from '../api/saved-jobs.keys'

export default function useSavedJobRecommendations(limit = 12) {
  const { user, isAuthenticated } = useSession()
  const isCandidate = isAuthenticated && user?.role === 'candidate'
  const candidateKey = isCandidate ? (user?.public_id || user?.id) : null
  const query = useQuery({
    queryKey: savedJobsKeys.recommendations(candidateKey, limit),
    queryFn: () => getSavedJobRecommendations(limit),
    enabled: Boolean(candidateKey),
  })
  const payload = query.data

  return {
    jobs: payload?.results ?? [],
    sourceSavedJobCount: payload?.source_saved_job_count ?? 0,
    strategy: payload?.strategy ?? null,
    loading: Boolean(candidateKey) && query.isPending,
    refreshing: Boolean(candidateKey) && query.isFetching && !query.isPending,
    error: query.error ?? null,
    reload: query.refetch,
  }
}
