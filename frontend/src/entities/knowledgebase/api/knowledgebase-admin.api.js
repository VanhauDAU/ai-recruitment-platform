import api from '@/shared/api/client'

function data(request) {
  return request.then((response) => response.data)
}

function normalizeMedia(item) {
  return {
    ...item,
    alt: item.default_alt_text,
    size: item.size_bytes,
  }
}

export const adminKnowledgeKeys = {
  root: ['admin-knowledgebase'],
  categories: ['admin-knowledgebase', 'categories'],
  articles: (params = {}) => ['admin-knowledgebase', 'articles', params],
  article: (publicId) => ['admin-knowledgebase', 'article', publicId],
  media: (params = {}) => ['admin-knowledgebase', 'media', params],
}

export function getAdminKnowledgeCategories({ signal } = {}) {
  return data(api.get('/knowledgebase/admin/categories/', { signal }))
}

export function createAdminKnowledgeCategory(payload) {
  return data(api.post('/knowledgebase/admin/categories/', payload))
}

export function updateAdminKnowledgeCategory(publicId, payload) {
  return data(api.patch(`/knowledgebase/admin/categories/${publicId}/`, payload))
}

export function reorderAdminKnowledgeCategories(publicIds) {
  return data(api.post('/knowledgebase/admin/categories/reorder/', { public_ids: publicIds }))
}

export function setAdminKnowledgeCategoryActive(publicId, isActive, revisionToken) {
  const action = isActive ? 'activate' : 'deactivate'
  return data(api.post(`/knowledgebase/admin/categories/${publicId}/${action}/`, {
    revision_token: revisionToken,
  }))
}

export function getAdminKnowledgeArticles(params = {}, { signal } = {}) {
  return data(api.get('/knowledgebase/admin/articles/', { params, signal }))
}

export function getAdminKnowledgeArticle(publicId, { signal } = {}) {
  return data(api.get(`/knowledgebase/admin/articles/${publicId}/`, { signal }))
}

export function createAdminKnowledgeArticle(payload) {
  return data(api.post('/knowledgebase/admin/articles/', payload))
}

export function updateAdminKnowledgeArticle(publicId, payload) {
  return data(api.patch(`/knowledgebase/admin/articles/${publicId}/`, payload))
}

export function createAdminKnowledgeRevision(publicId, payload) {
  return data(api.post(`/knowledgebase/admin/articles/${publicId}/revisions/`, payload))
}

export function updateAdminKnowledgeRevision(publicId, number, payload) {
  return data(api.patch(`/knowledgebase/admin/articles/${publicId}/revisions/${number}/`, payload))
}

export function runAdminKnowledgeRevisionAction(publicId, number, action, payload) {
  return data(api.post(
    `/knowledgebase/admin/articles/${publicId}/revisions/${number}/${action}/`,
    payload,
  ))
}

export function publishAdminKnowledgeRevision(publicId, payload) {
  return data(api.post(`/knowledgebase/admin/articles/${publicId}/publish/`, payload))
}

export function runAdminKnowledgeArticleLifecycle(publicId, action, revisionToken) {
  return data(api.post(`/knowledgebase/admin/articles/${publicId}/${action}/`, {
    revision_token: revisionToken,
  }))
}

export function getAdminKnowledgeMedia(params = {}, { signal } = {}) {
  return data(api.get('/knowledgebase/admin/media/', { params, signal })).then((response) => ({
    ...response,
    results: (response.results || []).map(normalizeMedia),
  }))
}

export function uploadAdminKnowledgeMedia(file) {
  const body = new FormData()
  body.append('file', file)
  return data(api.post('/knowledgebase/admin/media/', body)).then(normalizeMedia)
}
