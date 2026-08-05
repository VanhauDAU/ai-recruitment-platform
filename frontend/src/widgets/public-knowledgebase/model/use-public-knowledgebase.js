import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  getPublicKnowledgeArticles,
  getPublicKnowledgeCategories,
  isKnowledgeNotFound,
  publicKnowledgeKeys,
} from '@/entities/knowledgebase'
import { useKnowledgeSearch } from '@/features/search-knowledgebase'

const PAGE_SIZE = 20

function positivePage(value) {
  const page = Number.parseInt(value || '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export default function usePublicKnowledgebase(categorySlug) {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useKnowledgeSearch()
  const type = ['faq', 'guide'].includes(searchParams.get('type'))
    ? searchParams.get('type')
    : ''
  const page = positivePage(searchParams.get('page'))

  const categoriesQuery = useQuery({
    queryKey: publicKnowledgeKeys.categories,
    queryFn: ({ signal }) => getPublicKnowledgeCategories({ signal }),
    staleTime: 60_000,
  })
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const activeCategory = useMemo(
    () => categories.find((category) => category.slug === categorySlug) || null,
    [categories, categorySlug],
  )
  const categoryExists = !categorySlug || Boolean(activeCategory)
  const params = useMemo(() => ({
    ...(categorySlug ? { category: categorySlug } : {}),
    ...(search.query ? { q: search.query } : {}),
    ...(type ? { type } : {}),
    page,
    page_size: PAGE_SIZE,
  }), [categorySlug, page, search.query, type])
  const articlesQuery = useQuery({
    queryKey: publicKnowledgeKeys.articles(params),
    queryFn: ({ signal }) => getPublicKnowledgeArticles(params, { signal }),
    enabled: !categoriesQuery.isLoading && categoryExists,
    placeholderData: keepPreviousData,
  })
  const data = articlesQuery.data ?? { count: 0, results: [] }

  function setFilter(name, value) {
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next)
  }

  function setPage(nextPage) {
    const next = new URLSearchParams(searchParams)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setSearchParams(next)
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams())
  }

  const navigationParams = new URLSearchParams(searchParams)
  navigationParams.delete('page')

  const notFound = (
    isKnowledgeNotFound(categoriesQuery.error)
    || (!categoriesQuery.isLoading && Boolean(categorySlug) && !activeCategory)
    || isKnowledgeNotFound(articlesQuery.error)
  )
  const loading = categoriesQuery.isLoading || (
    categoryExists && articlesQuery.isLoading
  )
  const statusText = search.tooShort
    ? 'Nhập ít nhất 2 ký tự để tìm kiếm.'
    : articlesQuery.isFetching
      ? 'Đang cập nhật kết quả tìm kiếm.'
      : `${data.count || 0} kết quả trợ giúp.`

  return {
    activeCategory,
    categories,
    data,
    error: categoriesQuery.error || articlesQuery.error,
    loading,
    notFound,
    page,
    pageSize: PAGE_SIZE,
    queryString: navigationParams.toString(),
    refreshing: articlesQuery.isFetching && !articlesQuery.isLoading,
    search,
    statusText,
    type,
    retry: () => {
      categoriesQuery.refetch()
      articlesQuery.refetch()
    },
    resetFilters,
    setPage,
    setType: (value) => setFilter('type', value),
  }
}
