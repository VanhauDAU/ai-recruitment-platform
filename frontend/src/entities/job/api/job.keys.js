// Query keys cho domain job — đặt ở entity để mọi page/feature dùng chung
// một cache (vd. job stats được cả Home lẫn sidebar Jobs đọc).
export const jobKeys = {
  all: ['jobs'],
  list: (params) => ['jobs', 'list', params ?? {}],
  detail: (slug) => ['jobs', 'detail', slug],
  stats: ['jobs', 'stats'],
  categories: ['jobs', 'categories'],
  industries: ['jobs', 'industries'],
}
