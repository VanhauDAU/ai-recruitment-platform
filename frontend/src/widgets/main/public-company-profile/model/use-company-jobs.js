import { useQuery } from '@tanstack/react-query'
import { getJobs, jobKeys } from '@/entities/job/job'

export const COMPANY_JOBS_PAGE_SIZE = 10

// `category` là danh sách gộp dấu phẩy; backend đọc key lặp (category=1&category=2).
function apiParams({ category, ...params }) {
  if (!category?.includes(',')) return category ? { ...params, category } : params
  const search = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))
  category.split(',').forEach((id) => search.append('category', id))
  return search
}

/**
 * Tin công khai của một công ty, lọc theo mã công ty chứ không theo tên. Tab
 * tổng quan gọi không kèm bộ lọc nên dùng chung cache với trang 1 của tab việc làm.
 */
export function useCompanyJobs(companyPublicId, { q = '', location = '', category = '', page = 1 } = {}) {
  const params = {
    company: companyPublicId,
    page,
    page_size: COMPANY_JOBS_PAGE_SIZE,
    ...(q && { search: q }),
    ...(location && { location }),
    ...(category && { category }),
  }
  const query = useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => getJobs(apiParams(params)),
  })

  return {
    jobs: query.data?.results || [],
    count: query.data?.count || 0,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
