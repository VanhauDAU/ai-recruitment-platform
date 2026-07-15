import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getJobs, jobKeys } from '@/entities/job'
import { getProvinces, getWardsByParents } from '@/entities/location'
import {
  BEST_JOBS_PAGE_SIZE,
  BEST_JOBS_ROTATE_MS,
  EMPTY_BEST_JOBS_FILTERS,
  buildBestJobsChips,
  buildBestJobsParams,
} from '../lib/best-jobs-config'

const PRIORITY_PROVINCES = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']

async function loadFeaturedLocations() {
  const provinces = await getProvinces()
  const prioritized = [
    ...PRIORITY_PROVINCES
      .map((name) => provinces.find((province) => province.name.includes(name)))
      .filter(Boolean),
    ...provinces,
  ]
  const uniqueProvinces = Array.from(
    new Map(prioritized.map((province) => [province.id, province])).values(),
  ).slice(0, 5)
  const wards = await getWardsByParents(uniqueProvinces.map((province) => province.id)).catch(() => [])
  return { provinces, featuredWards: wards.slice(0, 15) }
}

export default function useBestJobsData(categories) {
  const [dimension, setDimension] = useState('location')
  const [filters, setFilters] = useState(EMPTY_BEST_JOBS_FILTERS)
  const [page, setPage] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const [paused, setPaused] = useState(false)

  const locationsQuery = useQuery({
    queryKey: ['locations', 'featured'],
    queryFn: loadFeaturedLocations,
    staleTime: 5 * 60_000,
  })
  const locationsData = locationsQuery.data
  const provinces = useMemo(() => locationsData?.provinces ?? [], [locationsData])
  const featuredWards = useMemo(() => locationsData?.featuredWards ?? [], [locationsData])

  const parents = useMemo(
    () => categories.filter((category) => category.parent == null),
    [categories],
  )
  const chips = useMemo(
    () => buildBestJobsChips(dimension, { featuredWards, parents, provinces }),
    [dimension, featuredWards, parents, provinces],
  )

  const jobsQuery = useQuery({
    queryKey: jobKeys.list(buildBestJobsParams(filters, page)),
    queryFn: () => getJobs(buildBestJobsParams(filters, page)),
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

  const totalPages = Math.max(1, Math.ceil(count / BEST_JOBS_PAGE_SIZE))

  useEffect(() => {
    if (paused || totalPages <= 1) return undefined
    const timer = setInterval(
      () => setPage((current) => (current % totalPages) + 1),
      BEST_JOBS_ROTATE_MS,
    )
    return () => clearInterval(timer)
  }, [paused, totalPages])

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
    totalPages,
    changeDimension,
    setPage,
    setPaused,
    toggleFilter,
  }
}
