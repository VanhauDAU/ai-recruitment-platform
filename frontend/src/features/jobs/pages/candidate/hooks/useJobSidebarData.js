import { useEffect, useState } from 'react'
import { getIndustries, getJobCategories, getJobStats, getJobs } from '@/features/jobs'
import { getProvinces } from '@/entities/location'

export default function useJobSidebarData() {
  const [categories, setCategories] = useState([])
  const [demandCounts, setDemandCounts] = useState({})
  const [provinces, setProvinces] = useState([])
  const [industries, setIndustries] = useState([])
  const [sidebarLoading, setSidebarLoading] = useState(true)
  const [noExpCount, setNoExpCount] = useState(null)

  useEffect(() => {
    setSidebarLoading(true)
    Promise.allSettled([
      getJobCategories().then(setCategories),
      getJobStats().then((stats) => {
        setDemandCounts(Object.fromEntries((stats.demand || []).map((item) => [item.id, item.count])))
      }),
      getProvinces().then(setProvinces),
      getIndustries().then(setIndustries),
    ]).finally(() => setSidebarLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    getJobs({ experience_years: 'none', page_size: 1 })
      .then((items) => {
        if (!cancelled) setNoExpCount(items.count ?? (items.results || items).length)
      })
      .catch(() => {
        if (!cancelled) setNoExpCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    categories,
    demandCounts,
    provinces,
    industries,
    sidebarLoading,
    noExpCount,
  }
}
