import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getNearbyJobMap, getNearbyJobs, jobKeys } from '@/entities/job/job'
import { nearbyApiParams } from '../lib/nearby-params'

// Danh sách (phân trang) và điểm bản đồ (không phân trang) cùng một bộ tham số.
export default function useNearbySearch(origin, filters, { enabled = true } = {}) {
  const params = origin ? nearbyApiParams(origin, filters) : null
  const mapParams = params && new URLSearchParams(params)
  mapParams?.delete('page')
  const active = enabled && Boolean(params)

  const listQuery = useQuery({
    queryKey: jobKeys.nearby(params),
    queryFn: () => getNearbyJobs(params),
    enabled: active,
    placeholderData: keepPreviousData,
  })
  const mapQuery = useQuery({
    queryKey: jobKeys.nearbyMap(mapParams),
    queryFn: () => getNearbyJobMap(mapParams),
    enabled: active,
    placeholderData: keepPreviousData,
  })

  return {
    jobs: listQuery.data?.results || [],
    count: listQuery.data?.count ?? 0,
    originInfo: listQuery.data?.origin || mapQuery.data?.origin || null,
    expandSuggestion: listQuery.data?.expand_suggestion || null,
    points: mapQuery.data?.points || [],
    truncated: Boolean(mapQuery.data?.truncated),
    loading: active && listQuery.isLoading,
    fetching: listQuery.isFetching,
    error: listQuery.isError,
  }
}
