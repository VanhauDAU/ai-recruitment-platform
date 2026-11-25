import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getHomepageBestJobLocations, getHomepageBestJobs, jobKeys } from '@/entities/job/job'
import {
  BEST_JOBS_PAGE_SIZE,
  EMPTY_BEST_JOBS_FILTERS,
  buildBestJobsChips,
  buildBestJobsParams,
} from '../lib/best-jobs-config'

export default function useBestJobsData(categories, pageSize = BEST_JOBS_PAGE_SIZE) {
  const [dimension, setDimension] = useState('location')
  const [filters, setFilters] = useState(EMPTY_BEST_JOBS_FILTERS)
  const [page, setPage] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const [paused, setPaused] = useState(false)

  // Chỉ tỉnh/phường đang có tin công khai, nhiều tin trước — chip nào cũng ra kết quả.
  const { data: locations } = useQuery({
    queryKey: jobKeys.homepageBestLocations(),
    queryFn: getHomepageBestJobLocations,
    staleTime: 5 * 60_000,
  })

  const parents = useMemo(
    () => categories.filter((category) => category.parent == null),
    [categories],
  )
  const chips = useMemo(
    () => buildBestJobsChips(dimension, { locations, parents }),
    [dimension, locations, parents],
  )

  const jobsQuery = useQuery({
    queryKey: jobKeys.homepageBest(buildBestJobsParams(filters, page, undefined, pageSize)),
    queryFn: () => getHomepageBestJobs(buildBestJobsParams(filters, page, undefined, pageSize)),
    placeholderData: keepPreviousData,
  })
  const jobsData = jobsQuery.data
  const jobs = useMemo(() => (jobsData ? jobsData.results || jobsData : []), [jobsData])
  const count = jobsData ? (jobsData.count ?? jobs.length) : 0
  const loading = jobsQuery.isFetching

  // Restart animation mỗi lần có dữ liệu mới (giữ hành vi cũ).
  useEffect(() => {
    if (jobsData) setAnimKey((key) => key + 1)
  }, [jobsData])

  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  // Tự chuyển trang do thanh tiến trình điều khiển (BestJobs gọi khi animation
  // chạy hết), nên thời gian, trạng thái dừng khi rê chuột và thanh luôn khớp nhau.
  function nextPage() {
    setPage((current) => (current % totalPages) + 1)
  }

  function changeDimension(nextDimension) {
    setDimension(nextDimension)
    setFilters(EMPTY_BEST_JOBS_FILTERS)
    setPage(1)
  }

  function toggleFilter(value) {
    setFilters((current) => ({
      ...EMPTY_BEST_JOBS_FILTERS,
      [dimension]: current[dimension] === value ? null : value,
    }))
    setPage(1)
  }

  return {
    activeChip: filters[dimension],
    animKey,
    chips,
    dimension,
    filters,
    jobs,
    loading,
    page,
    paused,
    totalPages,
    changeDimension,
    nextPage,
    setPage,
    setPaused,
    toggleFilter,
  }
}
