import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getJobs, jobKeys } from '@/entities/job/job'
import { toApiParams } from '../lib/job-list-params'

// Seed của phần gợi ý chèn giữa kết quả: một app load dùng chung để pagination ổn
// định; F5 tạo seed mới. Danh sách việc làm thì xếp hữu cơ, không cần seed (ADR-0030).
export const JOB_LIST_RANKING_SEED = globalThis.crypto?.randomUUID?.()
  ?? `jobs-${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function useJobListData(searchParams) {
  const params = toApiParams(searchParams)
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
    rankingSeed: JOB_LIST_RANKING_SEED,
    results: Array.isArray(data) ? data : data.results || [],
    count: Array.isArray(data) ? data.length : data.count || 0,
  }
}
