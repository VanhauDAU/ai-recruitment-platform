import { useEffect, useState } from 'react'
import { getJobs } from '@/entities/job'
import { toApiParams } from '../lib/job-list-params'

export default function useJobListData(searchParams) {
  const [data, setData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getJobs(toApiParams(searchParams))
      .then((items) => {
        if (!cancelled) setData(items)
      })
      .catch(() => {
        if (!cancelled) setData({ results: [], count: 0 })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchParams])

  return {
    data,
    loading,
    results: Array.isArray(data) ? data : data.results || [],
    count: Array.isArray(data) ? data.length : data.count || 0,
  }
}
