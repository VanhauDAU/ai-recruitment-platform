export const KNOWLEDGE_ROOT = '/tro-giup'

export function knowledgeCategoryPath(categorySlug) {
  return `${KNOWLEDGE_ROOT}/${categorySlug}`
}

export function knowledgeArticlePath(article) {
  return `${knowledgeCategoryPath(article.category.slug)}/${article.slug}`
}

export function isKnowledgeNotFound(error) {
  return error?.response?.status === 404
}
