import { useEffect, useState } from 'react'
import { getJobSuggestions } from '@/entities/job'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'

const MIN_KEYWORD_LENGTH = 2
const MAX_KEYWORD_SUGGESTIONS = 8

export default function useSearchSuggestions({ isOpen, keyword, searchBy }) {
  const debouncedKeyword = useDebouncedValue(keyword, 250)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const query = debouncedKeyword.trim()
    if (!isOpen || query.length < MIN_KEYWORD_LENGTH) {
      setSuggestions([])
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    getJobSuggestions(query, searchBy)
      .then((items) => {
        if (!cancelled) setSuggestions(items.slice(0, MAX_KEYWORD_SUGGESTIONS))
      })
      .catch((nextError) => {
        if (!cancelled) {
          setSuggestions([])
          setError(nextError)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedKeyword, isOpen, searchBy])

  return { suggestions, loading, error }
}
