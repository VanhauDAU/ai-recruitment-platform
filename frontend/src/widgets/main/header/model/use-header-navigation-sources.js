import { useQuery } from '@tanstack/react-query'
import { getBlogCategories } from '@/entities/content/blog'
import { getCvCategories } from '@/entities/cv/cv-template'
import { getIndustries, getJobCategories, jobKeys } from '@/entities/job/job'

const STALE_MS = 5 * 60_000

/**
 * A menu source as a list: `undefined` while loading (group shows a skeleton),
 * the items of a list or paginated page, and `[]` on error or any other shape
 * so a bad response hides the group instead of breaking the whole dropdown.
 */
export function settledList(query) {
  if (query.isError) return []
  if (query.data === undefined) return undefined
  const list = query.data?.results ?? query.data
  return Array.isArray(list) ? list : []
}

// Dữ liệu cho các nhóm menu động; chỉ tải khi người dùng mở menu lần đầu để
// không thêm request vào mọi lượt tải trang. Key trùng trang việc làm/mẫu CV
// nên dùng lại cache khi điều hướng sang đó.
export function useHeaderNavigationSources(enabled) {
  const options = { enabled, staleTime: STALE_MS }
  const jobCategories = useQuery({ queryKey: jobKeys.categories, queryFn: () => getJobCategories(), ...options })
  const industries = useQuery({ queryKey: jobKeys.industries, queryFn: getIndustries, ...options })
  const cvCategories = useQuery({ queryKey: ['cv-categories'], queryFn: () => getCvCategories(), ...options })
  const blogCategories = useQuery({ queryKey: ['blog', 'categories'], queryFn: getBlogCategories, ...options })
  return {
    jobGroups: settledList(jobCategories),
    industries: settledList(industries),
    cvStyles: settledList(cvCategories),
    cvPositions: settledList(cvCategories),
    blogCategories: settledList(blogCategories),
  }
}
