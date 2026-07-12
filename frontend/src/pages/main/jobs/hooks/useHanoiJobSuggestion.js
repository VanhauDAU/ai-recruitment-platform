import { useEffect, useState } from 'react'
import { getJobs } from '@/api/jobService'
import { toApiParams } from '../utils/jobListParams'

export default function useHanoiJobSuggestion(searchParams, provinces, hasSelectedLocation) {
  const [suggestion, setSuggestion] = useState(null)

  useEffect(() => {
    if (hasSelectedLocation || !provinces.length) {
      setSuggestion(null)
      return undefined
    }
    const hanoi = provinces.find((province) => province.name.includes('Hà Nội'))
    if (!hanoi) return undefined

    let cancelled = false
    const params = toApiParams(searchParams)
    params.delete('page')
    params.append('location', hanoi.id)
    params.set('page_size', '1')
    getJobs(params)
      .then((data) => {
        if (!cancelled) setSuggestion({ id: hanoi.id, count: data.count ?? 0 })
      })
      .catch(() => { if (!cancelled) setSuggestion(null) })
    return () => { cancelled = true }
  }, [hasSelectedLocation, provinces, searchParams])

  return suggestion
}
