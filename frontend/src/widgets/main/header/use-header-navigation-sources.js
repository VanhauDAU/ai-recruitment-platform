import { useQuery } from '@tanstack/react-query'
import { getBlogCategories } from '@/entities/content/blog'
import { getCvCategories } from '@/entities/cv/cv-template'
import { getIndustries, getJobCategories, jobKeys } from '@/entities/job/job'

const STALE_MS = 5 * 60_000

// Dữ liệu cho các nhóm menu động; chỉ tải khi người dùng mở menu lần đầu để
// không thêm request vào mọi lượt tải trang. Key trùng trang việc làm/mẫu CV
// nên dùng lại cache khi điều hướng sang đó.
export function useHeaderNavigationSources(enabled) {
  const options = { enabled, staleTime: STALE_MS }
  const jobCategories = useQuery({ queryKey: jobKeys.categories, queryFn: () => getJobCategories(), ...options })
  const industries = useQuery({ queryKey: jobKeys.industries, queryFn: getIndustries, ...options })
  const cvCategories = useQuery({ queryKey: ['cv-categories'], queryFn: () => getCvCategories(), ...options })
  const blogCategories = useQuery({ queryKey: ['blog', 'categories'], queryFn: getBlogCategories, ...options })
  // Lỗi tải coi như rỗng để ẩn nhóm thay vì kẹt skeleton.
  const settled = (query) => (query.isError ? [] : query.data)
  return {
    jobGroups: settled(jobCategories),
    industries: settled(industries),
    cvStyles: settled(cvCategories),
    cvPositions: settled(cvCategories),
    blogCategories: settled(blogCategories),
  }
}
