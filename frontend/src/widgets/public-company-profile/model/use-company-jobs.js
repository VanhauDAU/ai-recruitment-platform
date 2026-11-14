import { useQuery } from '@tanstack/react-query'
import { getJobs, jobKeys } from '@/entities/job'

export const COMPANY_JOBS_PAGE_SIZE = 10

/**
 * Tin công khai của một công ty, lọc theo mã công ty chứ không theo tên. Tab
 * tổng quan gọi không kèm bộ lọc nên dùng chung cache với trang 1 của tab việc làm.
 */
export function useCompanyJobs(companyPublicId, { q = '', location = '', page = 1 } = {}) {
  const params = {
    company: companyPublicId,
    page,
    page_size: COMPANY_JOBS_PAGE_SIZE,
    ...(q && { search: q }),
    ...(location && { location }),
  }
  const query = useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => getJobs(params),
  })

  return {
    jobs: query.data?.results || [],
    count: query.data?.count || 0,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
