import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/**
 * URL-backed filters plus "load more" pages of a feed endpoint. Filters live in
 * the query string so a link or back/forward restores the same view.
 */
export default function useEventFeed({ filterKeys, queryKey, fetchPage }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // `filterKeys` must be a module constant so the memo only follows the URL.
  const filters = useMemo(
    () => Object.fromEntries(filterKeys.map((key) => [key, searchParams.get(key) || ''])),
    [filterKeys, searchParams],
  )
  const params = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    [filters],
  )
  const query = useInfiniteQuery({
    queryKey: queryKey(params),
    queryFn: ({ pageParam }) => fetchPage({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage?.next ? pages.length + 1 : undefined),
    // Keep the rows and tab counts on screen while another filter loads.
    placeholderData: keepPreviousData,
  })
  const setFilters = useCallback((next) => {
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current)
      Object.entries(next).forEach(([key, value]) => {
        if (value) nextParams.set(key, String(value))
        else nextParams.delete(key)
      })
      return nextParams
    }, { replace: true })
  }, [setSearchParams])
  const pages = query.data?.pages || []
  return {
    filters,
    setFilters,
    clearFilters: () => setSearchParams({}, { replace: true }),
    query,
    items: pages.flatMap((page) => page?.results || []),
    firstPage: pages[0],
  }
}
