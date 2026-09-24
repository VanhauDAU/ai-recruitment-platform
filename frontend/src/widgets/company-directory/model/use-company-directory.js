import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { companyKeys, getPublicCompanies } from '@/entities/company'

export function nextCompanyCursor(page) {
  if (!page?.next) return undefined
  try {
    return new URL(page.next, 'http://localhost').searchParams.get('cursor') || undefined
  } catch {
    return undefined
  }
}

function uniqueCompanies(pages) {
  const seen = new Set()
  return pages.flatMap((page) => page?.results || []).filter((company) => {
    if (!company?.public_id || seen.has(company.public_id)) return false
    seen.add(company.public_id)
    return true
  })
}

export function useCompanyDirectory(keyword = '', {
  featuredRequestKey = 0,
  mode = keyword.trim() ? 'search' : 'featured',
} = {}) {
  const normalizedKeyword = keyword.trim()
  const isSearch = mode === 'search'
  const hasSearchKeyword = isSearch && Boolean(normalizedKeyword)
  const featuredQuery = useQuery({
    queryKey: companyKeys.featured(featuredRequestKey),
    queryFn: ({ signal }) => getPublicCompanies({}, { signal }),
    enabled: !isSearch || hasSearchKeyword,
    // Featured order is intentionally shuffled by the API. A remount must
    // fetch a fresh order instead of treating the previous response as fresh.
    // Search treats an inherited shuffle as fresh for the lifetime of that
    // route. A direct search still has no data for its unique key and fetches.
    staleTime: isSearch ? Infinity : 0,
    // Search routes inherit the featured-page key so their sidebar can reuse
    // that shuffle. A direct search has no cached entry and still fetches it.
    refetchOnMount: isSearch ? false : 'always',
    refetchOnWindowFocus: false,
  })
  const searchQuery = useInfiniteQuery({
    queryKey: companyKeys.search(normalizedKeyword),
    queryFn: ({ pageParam, signal }) => getPublicCompanies(
      {
        // `keyword` is the public URL contract; the backend intentionally
        // keeps the compact `q` API parameter.
        q: normalizedKeyword,
        ...(pageParam ? { cursor: pageParam } : {}),
      },
      { signal },
    ),
    enabled: hasSearchKeyword,
    initialPageParam: null,
    getNextPageParam: nextCompanyCursor,
    staleTime: 60_000,
  })

  const featuredCompanies = useMemo(
    () => uniqueCompanies(featuredQuery.data ? [featuredQuery.data] : []),
    [featuredQuery.data],
  )
  const searchCompanies = useMemo(
    () => uniqueCompanies(searchQuery.data?.pages || []),
    [searchQuery.data],
  )
  const firstSearchPage = searchQuery.data?.pages?.[0]
  const totalCount = Number.isFinite(firstSearchPage?.count)
    ? firstSearchPage.count
    : undefined
  const activeQuery = isSearch ? searchQuery : featuredQuery

  return {
    ...activeQuery,
    companies: isSearch
      ? (hasSearchKeyword ? searchCompanies : [])
      : featuredCompanies,
    fetchNextPage: searchQuery.fetchNextPage,
    featuredCompanies,
    hasNextPage: hasSearchKeyword && searchQuery.hasNextPage,
    hasSearchKeyword,
    isFeaturedError: featuredQuery.isError,
    isFeaturedPending: featuredQuery.isPending,
    isFetchNextPageError: hasSearchKeyword && searchQuery.isFetchNextPageError,
    isFetchingNextPage: hasSearchKeyword && searchQuery.isFetchingNextPage,
    isPending: isSearch && !hasSearchKeyword ? false : activeQuery.isPending,
    isSearch,
    refetchFeatured: featuredQuery.refetch,
    totalCount,
  }
}
