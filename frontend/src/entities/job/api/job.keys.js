// URLSearchParams không có enumerable property, nên React Query hash mọi instance
// thành cùng một object rỗng. Chuyển nó sang chuỗi để mỗi tổ hợp filter/trang có
// cache key riêng; object thường vẫn giữ nguyên contract hiện có của consumer.
function normalizeListParams(params) {
  if (typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams) {
    return params.toString()
  }
  return params ?? {}
}

// Query keys cho domain job — đặt ở entity để mọi page/feature dùng chung
// một cache (vd. job stats được cả Home lẫn sidebar Jobs đọc).
export const jobKeys = {
  all: ['jobs'],
  list: (params) => ['jobs', 'list', normalizeListParams(params)],
  detail: (slug) => ['jobs', 'detail', slug],
  stats: ['jobs', 'stats'],
  categories: ['jobs', 'categories'],
  industries: ['jobs', 'industries'],
}
