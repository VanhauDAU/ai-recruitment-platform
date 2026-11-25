import api from '@/shared/api/client'
import { invalidateRequestCache } from '@/shared/api/request-deduplication'

function data(request) {
  return request.then((response) => response.data)
}

export const adminBlogKeys = {
  root: ['admin-blog'],
  posts: (params = {}) => ['admin-blog', 'posts', params],
  post: (publicId) => ['admin-blog', 'post', publicId],
  summary: ['admin-blog', 'summary'],
  categories: ['admin-blog', 'categories'],
  tags: (params = {}) => ['admin-blog', 'tags', params],
  media: (params = {}) => ['admin-blog', 'media', params],
  pins: ['admin-blog', 'pins'],
}

export function invalidatePublicBlogCache(slug) {
  invalidateRequestCache('blog-home')
  invalidateRequestCache('blog-categories')
  invalidateRequestCache('blog-pinned')
  if (slug) invalidateRequestCache(`blog-post:${slug}`)
}

export function getAdminBlogPosts(params = {}, { signal } = {}) {
  return data(api.get('/admin/blog/posts/', { params, signal }))
}

export function getAdminBlogSummary({ signal } = {}) {
  return data(api.get('/admin/blog/posts/summary/', { signal }))
}

export function getAdminBlogPost(publicId, { signal } = {}) {
  return data(api.get(`/admin/blog/posts/${publicId}/`, { signal }))
}

export function createAdminBlogPost(payload) {
  return data(api.post('/admin/blog/posts/', payload))
}

export function saveAdminBlogDraft(publicId, payload) {
  return data(api.patch(`/admin/blog/posts/${publicId}/draft/`, payload))
}

export function runAdminBlogAction(publicId, action, payload = {}) {
  return data(api.post(`/admin/blog/posts/${publicId}/${action}/`, payload))
}

export function getAdminBlogCategories({ signal } = {}) {
  return data(api.get('/admin/blog/categories/', { signal }))
}

export function createAdminBlogCategory(payload) {
  return data(api.post('/admin/blog/categories/', payload)).then((result) => {
    invalidateRequestCache('blog-categories')
    invalidateRequestCache('blog-home')
    return result
  })
}

export function updateAdminBlogCategory(publicId, payload) {
  return data(api.patch(`/admin/blog/categories/${publicId}/`, payload)).then((result) => {
    invalidateRequestCache('blog-categories')
    invalidateRequestCache('blog-home')
    return result
  })
}

export function reorderAdminBlogCategories(publicIds) {
  return data(api.post('/admin/blog/categories/reorder/', { public_ids: publicIds })).then((result) => {
    invalidateRequestCache('blog-categories')
    invalidateRequestCache('blog-home')
    return result
  })
}

export function getAdminBlogTags(params = {}, { signal } = {}) {
  return data(api.get('/admin/blog/tags/', { params, signal }))
}

export function createAdminBlogTag(payload) {
  return data(api.post('/admin/blog/tags/', payload))
}

export function updateAdminBlogTag(publicId, payload) {
  return data(api.patch(`/admin/blog/tags/${publicId}/`, payload))
}

export function deleteAdminBlogTag(publicId) {
  return data(api.delete(`/admin/blog/tags/${publicId}/`))
}

export function mergeAdminBlogTag(publicId, targetPublicId) {
  return data(api.post(`/admin/blog/tags/${publicId}/merge/`, {
    target_public_id: targetPublicId,
  }))
}

export function getAdminBlogPins({ signal } = {}) {
  return data(api.get('/admin/blog/pins/', { signal }))
}

export function createAdminBlogPin(payload) {
  return data(api.post('/admin/blog/pins/', payload)).then((result) => {
    invalidateRequestCache('blog-pinned')
    return result
  })
}

export function updateAdminBlogPin(publicId, payload) {
  return data(api.patch(`/admin/blog/pins/${publicId}/`, payload)).then((result) => {
    invalidateRequestCache('blog-pinned')
    return result
  })
}

export function deleteAdminBlogPin(publicId) {
  return data(api.delete(`/admin/blog/pins/${publicId}/`)).then((result) => {
    invalidateRequestCache('blog-pinned')
    return result
  })
}

export function reorderAdminBlogPins(publicIds) {
  return data(api.post('/admin/blog/pins/reorder/', { public_ids: publicIds })).then((result) => {
    invalidateRequestCache('blog-pinned')
    return result
  })
}

async function upload(path, file) {
  const body = new FormData()
  body.append('file', file)
  return data(api.post(path, body))
}

export function uploadAdminBlogContentImage(file) {
  return upload('/admin/blog/uploads/', file)
}

export function getAdminBlogMedia(params = {}, { signal } = {}) {
  return data(api.get('/admin/blog/uploads/', { params, signal }))
}

export function uploadAdminBlogThumbnail(file) {
  return upload('/admin/blog/thumbnails/', file)
}

export function importAdminBlogThumbnail(url) {
  return data(api.post('/admin/blog/thumbnails/', { url }))
}
