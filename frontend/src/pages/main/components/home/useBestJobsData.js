import { useEffect, useMemo, useState } from 'react'
import { getJobs } from '@/api/jobService'
import { getProvinces, getWardsByParents } from '@/api/locationService'
import {
  BEST_JOBS_PAGE_SIZE,
  BEST_JOBS_ROTATE_MS,
  EMPTY_BEST_JOBS_FILTERS,
  buildBestJobsChips,
  buildBestJobsParams,
} from './bestJobsConfig'

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
  const [provinces, setProvinces] = useState([])
  const [featuredWards, setFeaturedWards] = useState([])
  const [jobs, setJobs] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadFeaturedLocations()
      .then((data) => {
        if (!cancelled) {
          setProvinces(data.provinces)
          setFeaturedWards(data.featuredWards)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProvinces([])
          setFeaturedWards([])
        }
      })
    return () => { cancelled = true }
  }, [])

  const parents = useMemo(
    () => categories.filter((category) => category.parent == null),
    [categories],
  )
  const chips = useMemo(
    () => buildBestJobsChips(dimension, { featuredWards, parents, provinces }),
    [dimension, featuredWards, parents, provinces],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getJobs(buildBestJobsParams(filters, page))
      .then((data) => {
        if (cancelled) return
        const results = data.results || data
        setJobs(results)
        setCount(data.count ?? results.length)
        setAnimKey((key) => key + 1)
      })
      .catch(() => {
        if (!cancelled) {
          setJobs([])
          setCount(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [filters, page])

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
