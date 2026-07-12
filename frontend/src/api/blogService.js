import api from './api'
import { cachedRequest, dedupeRequest } from './requestDeduplication'

const CATALOG_CACHE_TTL = 5 * 60 * 1000

// Danh sách bài viết (phân trang). Lọc theo ?category / ?tag / ?q / ?page.
export async function getBlogPosts(params = {}) {
  const { data } = await api.get('/blog/', { params })
  return data
}

// Trang /blog kiểu magazine: featured + section theo danh mục trong 1 request.
export async function getBlogHome() {
  return cachedRequest('blog-home', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/blog/home/')
    return data
  })
}

export async function getBlogPost(slug) {
  return dedupeRequest(`blog-post:${slug}`, async () => {
    const { data } = await api.get(`/blog/${slug}/`)
    return data
  })
}

// Danh mục cho thanh danh mục ngang — đổi ít nên cache như catalog.
export async function getBlogCategories() {
  return cachedRequest('blog-categories', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/blog/categories/')
    return data
  })
}

// Khối "Tài liệu hỗ trợ tìm việc" ở sidebar chi tiết.
export async function getBlogPinnedPosts() {
  return cachedRequest('blog-pinned', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/blog/pinned/')
    return data
  })
}
