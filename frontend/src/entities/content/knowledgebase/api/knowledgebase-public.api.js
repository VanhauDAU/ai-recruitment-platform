import api from '@/shared/api/client'

function data(request) {
  return request.then((response) => response.data)
}

export const publicKnowledgeKeys = {
  root: ['public-knowledgebase'],
  categories: ['public-knowledgebase', 'categories'],
  articles: (params = {}) => ['public-knowledgebase', 'articles', params],
  article: (categorySlug, articleSlug) => [
    'public-knowledgebase',
    'article',
    categorySlug,
    articleSlug,
  ],
}

export function getPublicKnowledgeCategories({ signal } = {}) {
  return data(api.get('/public/knowledgebase/categories/', { signal }))
}

export function getPublicKnowledgeArticles(params = {}, { signal } = {}) {
  return data(api.get('/public/knowledgebase/articles/', { params, signal }))
}

export function getPublicKnowledgeArticle(categorySlug, articleSlug, { signal } = {}) {
  return data(api.get(
    `/public/knowledgebase/articles/${encodeURIComponent(categorySlug)}/${encodeURIComponent(articleSlug)}/`,
    { signal },
  ))
}
