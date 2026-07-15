import { useQuery } from '@tanstack/react-query'
import { getSavedJobs } from '../api/saved-jobs.api'
import { savedJobsKeys } from '../api/saved-jobs.keys'

export default function useSavedJobsQuery(candidateKey) {
  const query = useQuery({
    queryKey: savedJobsKeys.list(candidateKey),
    queryFn: async () => {
      const data = await getSavedJobs()
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(candidateKey),
  })

  return {
    items: candidateKey ? (query.data ?? []) : [],
    loading: query.isFetching,
    error: query.error ?? null,
    reload: query.refetch,
  }
}
