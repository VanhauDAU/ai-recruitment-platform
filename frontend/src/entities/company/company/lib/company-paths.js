export const COMPANY_DIRECTORY_PATH = '/cong-ty'
export const COMPANY_SEARCH_PATH = '/cong-ty/tim-kiem'
export const COMPANY_DETAIL_ROUTE = '/cong-ty/:slug'
export const COMPANY_JOBS_TAB = 'viec-lam'

const MAX_JOB_KEYWORD_LENGTH = 120

function normalizedCompanyName(companyOrName) {
  if (typeof companyOrName === 'string') return companyOrName.trim()
  return (companyOrName?.company_name || companyOrName?.trade_name || '').trim()
}

// Lối lùi khi chưa có slug: danh bạ đã lọc theo tên công ty.
function companyDirectoryPath(companyOrName) {
  const companyName = normalizedCompanyName(companyOrName)
  if (!companyName) return COMPANY_DIRECTORY_PATH
  return companySearchPath(companyName)
}

export function companySearchPath(keyword) {
  const normalizedKeyword = String(keyword || '').trim()
  if (!normalizedKeyword) return COMPANY_SEARCH_PATH
  return `${COMPANY_SEARCH_PATH}?${new URLSearchParams({ keyword: normalizedKeyword })}`
}

/**
 * Trang công ty công khai. Nhận slug hoặc DTO công ty có `slug`; không nhận tin
 * tuyển dụng vì `slug` của tin là slug của chính tin đó (dùng `jobCompanyPath`).
 * Bộ lọc `q`/`location`/`page` chỉ thuộc tab việc làm nên bị bỏ ở tab tổng quan.
 * Thiếu slug thì quay về danh bạ đã lọc theo tên.
 */
export function companyDetailPath(slugOrCompany, { tab, q, location, page } = {}) {
  const slug = String(
    (typeof slugOrCompany === 'string' ? slugOrCompany : slugOrCompany?.slug) || '',
  ).trim()
  if (!slug) return companyDirectoryPath(slugOrCompany)

  const params = new URLSearchParams()
  if (tab === COMPANY_JOBS_TAB) {
    params.set('tab', COMPANY_JOBS_TAB)
    const keyword = String(q || '').trim()
    if (keyword) params.set('q', keyword)
    if (location) params.set('location', String(location))
    if (page > 1) params.set('page', String(page))
  }
  const query = params.toString()
  return `${COMPANY_DIRECTORY_PATH}/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`
}

/** Chiều ngược của `companyDetailPath`: chuẩn hoá query của trang công ty. */
export function parseCompanyDetailQuery(searchParams) {
  if (searchParams.get('tab') !== COMPANY_JOBS_TAB) {
    return { tab: '', q: '', location: '', page: 1 }
  }
  const location = searchParams.get('location') || ''
  const page = Number(searchParams.get('page'))
  return {
    tab: COMPANY_JOBS_TAB,
    q: (searchParams.get('q') || '').trim().slice(0, MAX_JOB_KEYWORD_LENGTH),
    location: /^\d+$/.test(location) ? location : '',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** `/cong-ty/<slug>` nhưng không phải route tìm kiếm của danh bạ. */
export function isCompanyDetailPath(pathname) {
  if (pathname === COMPANY_SEARCH_PATH || !pathname.startsWith(`${COMPANY_DIRECTORY_PATH}/`)) {
    return false
  }
  const slug = pathname.slice(COMPANY_DIRECTORY_PATH.length + 1)
  return Boolean(slug) && !slug.includes('/')
}

/**
 * Liên kết công ty từ một tin tuyển dụng. `company_slug` là null khi công ty
 * đang bị tạm ẩn, lúc đó chỉ còn danh bạ lọc theo tên.
 */
export function jobCompanyPath(job) {
  return job?.company_slug ? companyDetailPath(job.company_slug) : companyDirectoryPath(job)
}
