import { useCallback, useEffect, useRef, useState } from 'react'
import { getSavedJobs } from '../api/saved-jobs.api'

export default function useSavedJobsQuery(candidateKey) {
  const requestId = useRef(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!candidateKey) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const data = await getSavedJobs()
      if (currentRequest === requestId.current) {
        setItems(Array.isArray(data) ? data : [])
        setError(null)
      }
    } catch (nextError) {
      if (currentRequest === requestId.current) {
        setItems([])
        setError(nextError)
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [candidateKey])

  useEffect(() => {
    reload()
  }, [reload])

  return { items, setItems, loading, error, setError, reload }
}
