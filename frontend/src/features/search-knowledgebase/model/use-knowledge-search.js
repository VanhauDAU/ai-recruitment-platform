import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

const SEARCH_DELAY_MS = 350

export default function useKnowledgeSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  const [input, setInput] = useState(urlQuery)

  useEffect(() => setInput(urlQuery), [urlQuery])

  const commit = useCallback((value, { replace = true } = {}) => {
    const trimmed = value.trim()
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    if (trimmed.length >= 2) next.set('q', trimmed)
    else next.delete('q')
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (input === urlQuery) return undefined
    const timer = window.setTimeout(() => commit(input), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [commit, input, urlQuery])

  function submit(event) {
    event.preventDefault()
    commit(input, { replace: false })
  }

  function clear() {
    setInput('')
    commit('')
  }

  return {
    input,
    query: urlQuery.length >= 2 ? urlQuery : '',
    tooShort: input.trim().length === 1,
    clear,
    setInput,
    submit,
  }
}
