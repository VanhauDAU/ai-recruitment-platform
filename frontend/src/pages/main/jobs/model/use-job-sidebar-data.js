import { useQuery } from '@tanstack/react-query'
import { getIndustries, getJobCategories, getJobStats, jobKeys } from '@/entities/job/job'
import { getProvinces } from '@/entities/system/location'

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

  const settled = [categoriesQuery, statsQuery, provincesQuery, industriesQuery]
    .every((query) => !query.isLoading)

  return {
    categories: categoriesQuery.data ?? [],
    demandCounts: statsQuery.data ?? {},
    provinces: provincesQuery.data ?? [],
    industries: industriesQuery.data ?? [],
    sidebarLoading: !settled,
  }
}
