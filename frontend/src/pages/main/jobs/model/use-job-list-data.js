import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getJobs, jobKeys } from '@/entities/job'
import { toApiParams } from '../lib/job-list-params'

const JOB_LIST_RANKING_SEED = globalThis.crypto?.randomUUID?.()
  ?? `jobs-${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function useJobListData(searchParams) {
  const params = toApiParams(searchParams)
  // Một app load dùng cùng seed xuyên filter/page để pagination ổn định.
  // Browser F5 khởi tạo lại module và tạo seed mới để luân phiên trong từng tầng.
  if (!params.get('ordering')) params.set('ranking_seed', JOB_LIST_RANKING_SEED)
  const query = useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => getJobs(params),
    // Giữ data cũ làm placeholder để query transition ổn định; UI dùng
    // isPlaceholderData bên dưới để không gắn kết quả cũ với bộ lọc mới.
    placeholderData: keepPreviousData,
  })

  const data = query.data ?? { results: [], count: 0 }
  return {
    data,
    // Chuyển page/filter chặn bằng skeleton; cùng-key background sync vẫn giữ
    // cards hiện tại để tránh nháy trắng.
    loading: query.isPending || query.isPlaceholderData,
    refreshing: query.isFetching && !query.isPending,
    results: Array.isArray(data) ? data : data.results || [],
    count: Array.isArray(data) ? data.length : data.count || 0,
  }
}
