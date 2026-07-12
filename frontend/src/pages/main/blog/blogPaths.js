// URL trang blog. Dùng /blog/... thay vì slug ở root để không đụng route SPA.
export const BLOG_ROOT = '/blog'
export const blogPostPath = (slug) => `/blog/${slug}`
export const blogCategoryPath = (slug) => `/blog/danh-muc/${slug}`

export function formatBlogDate(value, { withTime = false } = {}) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  if (!withTime) return day
  return `${day} · ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
}
