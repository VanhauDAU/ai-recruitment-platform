import { useEffect, useState } from 'react'
import { getJobs } from '@/entities/job'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { getHistory } from './search-history'

const MIN_SUGGESTED = 6

export default function useSuggestedJobs({ isOpen, keyword, searchBy }) {
  const debouncedKeyword = useDebouncedValue(keyword, 250)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const history = getHistory()
    const query = debouncedKeyword.trim()
    const base = query
      ? { search: query, by: searchBy }
      : history[0] ? { search: history[0].q, by: history[0].by } : null
    let cancelled = false
    setLoading(true)
    setError(null)

    async function loadJobs() {
      let results = []
      try {
        if (base) {
          const params = { page_size: 8, search: base.search }
          if (base.by !== 'title') params.search_by = base.by
          const data = await getJobs(params)
          results = data.results || data
        }
        if (results.length < MIN_SUGGESTED) {
          const seen = new Set(results.map((job) => job.public_id))
          const newest = await getJobs({ page_size: MIN_SUGGESTED + 3 })
          for (const job of newest.results || newest) {
            if (results.length >= MIN_SUGGESTED) break
            if (!seen.has(job.public_id)) results.push(job)
          }
        }
      } catch (nextError) {
        results = []
        if (!cancelled) setError(nextError)
      }
      if (!cancelled) {
        setJobs(results.slice(0, MIN_SUGGESTED))
        setLoading(false)
      }
    }

    loadJobs()
    return () => {
      cancelled = true
    }
  }, [debouncedKeyword, isOpen, searchBy])

  return { jobs, loading, error }
}
