import { useQuery } from '@tanstack/react-query'
import { getJobs, jobKeys } from '@/entities/job/job'

const PAGE_SIZE = 10
const MAX_SHOWN = 6

/**
 * Tin khác của cùng công ty cho tab "Công ty" (mobile), hiện tối đa 6. Chỉ gọi khi tab được mở;
 * cùng key với trang 1 tab việc làm của trang công ty nên dùng chung cache.
 */
export default function useCompanyOtherJobs(job, { enabled = true } = {}) {
  const companyId = job?.company_public_id
  const params = { company: companyId, page: 1, page_size: PAGE_SIZE }
  const query = useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => getJobs(params),
    enabled: Boolean(companyId) && enabled,
  })
  const others = (query.data?.results || []).filter((item) => item.public_id !== job?.public_id)
  return {
    jobs: others.slice(0, MAX_SHOWN),
    // `count` tính cả tin đang xem.
    total: Math.max((query.data?.count || 0) - 1, others.length),
    isPending: query.isPending && query.fetchStatus !== 'idle',
  }
}
