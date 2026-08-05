import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  getPublicKnowledgeArticles,
  getPublicKnowledgeCategories,
  isKnowledgeNotFound,
  publicKnowledgeKeys,
} from '@/entities/knowledgebase'

const PAGE_SIZE = 60

function positivePage(value) {
  const page = Number.parseInt(value || '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export default function usePublicKnowledgebase(categorySlug) {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = positivePage(searchParams.get('page'))
  const hasIndexingParameters = ['q', 'type', 'page'].some((name) => searchParams.has(name))

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
    page,
    page_size: PAGE_SIZE,
  }), [categorySlug, page])
  const articlesQuery = useQuery({
    queryKey: publicKnowledgeKeys.articles(params),
    queryFn: ({ signal }) => getPublicKnowledgeArticles(params, { signal }),
    enabled: !categoriesQuery.isLoading && categoryExists,
    placeholderData: keepPreviousData,
  })
  const data = articlesQuery.data ?? { count: 0, results: [] }

  function setPage(nextPage) {
    const next = new URLSearchParams()
    if (nextPage > 1) next.set('page', String(nextPage))
    setSearchParams(next)
  }

  const notFound = (
    isKnowledgeNotFound(categoriesQuery.error)
    || (!categoriesQuery.isLoading && Boolean(categorySlug) && !activeCategory)
    || isKnowledgeNotFound(articlesQuery.error)
  )
  const loading = categoriesQuery.isLoading || (
    categoryExists && articlesQuery.isLoading
  )
  return {
    activeCategory,
    categories,
    data,
    error: categoriesQuery.error || articlesQuery.error,
    hasIndexingParameters,
    loading,
    notFound,
    page,
    pageSize: PAGE_SIZE,
    refreshing: articlesQuery.isFetching && !articlesQuery.isLoading,
    retry: () => {
      categoriesQuery.refetch()
      articlesQuery.refetch()
    },
    setPage,
  }
}
