import { useQuery } from '@tanstack/react-query'
import {
  getPublicKnowledgeArticle,
  getPublicKnowledgeCategories,
  isKnowledgeNotFound,
  publicKnowledgeKeys,
} from '@/entities/knowledgebase'

export default function usePublicKnowledgeArticle(categorySlug, articleSlug) {
  const categoriesQuery = useQuery({
    queryKey: publicKnowledgeKeys.categories,
    queryFn: ({ signal }) => getPublicKnowledgeCategories({ signal }),
    staleTime: 60_000,
  })
  const articleQuery = useQuery({
    queryKey: publicKnowledgeKeys.article(categorySlug, articleSlug),
    queryFn: ({ signal }) => getPublicKnowledgeArticle(
      categorySlug,
      articleSlug,
      { signal },
    ),
    enabled: Boolean(categorySlug && articleSlug),
  })

  return {
    article: articleQuery.data ?? null,
    categories: categoriesQuery.data ?? [],
    error: categoriesQuery.error || articleQuery.error,
    loading: categoriesQuery.isLoading || articleQuery.isLoading,
    notFound: isKnowledgeNotFound(categoriesQuery.error) || isKnowledgeNotFound(articleQuery.error),
    retry: () => {
      categoriesQuery.refetch()
      articleQuery.refetch()
    },
  }
}
