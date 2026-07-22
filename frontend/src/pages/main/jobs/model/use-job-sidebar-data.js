import { useQuery } from '@tanstack/react-query'
import { getIndustries, getJobCategories, getJobStats, getJobs, jobKeys } from '@/entities/job'
import { getProvinces } from '@/entities/location'

// Dữ liệu tĩnh của sidebar (danh mục, tỉnh thành, ngành) đổi rất chậm —
// giữ tươi 5 phút để không refetch khi điều hướng qua lại.
const SIDEBAR_STALE_MS = 5 * 60_000

export default function useJobSidebarData() {
  const categoriesQuery = useQuery({
    queryKey: jobKeys.categories,
    queryFn: () => getJobCategories(),
    staleTime: SIDEBAR_STALE_MS,
  })
  const statsQuery = useQuery({
    queryKey: jobKeys.stats,
    queryFn: getJobStats,
    staleTime: SIDEBAR_STALE_MS,
    select: (stats) => Object.fromEntries((stats.demand || []).map((item) => [item.id, item.count])),
  })
  const provincesQuery = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: getProvinces,
    staleTime: SIDEBAR_STALE_MS,
  })
  const industriesQuery = useQuery({
    queryKey: jobKeys.industries,
    queryFn: getIndustries,
    staleTime: SIDEBAR_STALE_MS,
  })
  const noExpQuery = useQuery({
    queryKey: jobKeys.list({ experience_years: 'none', page_size: 1 }),
    queryFn: () => getJobs({ experience_years: 'none', page_size: 1 }),
    staleTime: SIDEBAR_STALE_MS,
    select: (items) => items.count ?? (items.results || items).length,
  })

  const settled = [categoriesQuery, statsQuery, provincesQuery, industriesQuery]
    .every((query) => !query.isLoading)

  return {
    categories: categoriesQuery.data ?? [],
    demandCounts: statsQuery.data ?? {},
    provinces: provincesQuery.data ?? [],
    industries: industriesQuery.data ?? [],
    sidebarLoading: !settled,
    noExpCount: noExpQuery.data ?? null,
  }
}
