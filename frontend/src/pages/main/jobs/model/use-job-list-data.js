import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getJobs, jobKeys } from '@/entities/job'
import { toApiParams } from '../lib/job-list-params'

export default function useJobListData(searchParams) {
  const params = toApiParams(searchParams)
  const query = useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => getJobs(params),
    // Giữ trang cũ hiển thị trong lúc tải filter/trang mới (hành vi cũ).
    placeholderData: keepPreviousData,
  })

  const data = query.data ?? { results: [], count: 0 }
  return {
    data,
    loading: query.isFetching,
    results: Array.isArray(data) ? data : data.results || [],
    count: Array.isArray(data) ? data.length : data.count || 0,
  }
}
