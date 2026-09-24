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
  publicLists: () => [...jobKeys.all, 'list'],
  list: (params) => [...jobKeys.publicLists(), normalizeListParams(params)],
  homepageBest: (params) => [...jobKeys.all, 'homepage-best', normalizeListParams(params)],
  detail: (slug) => ['jobs', 'detail', slug],
  stats: ['jobs', 'stats'],
  categories: ['jobs', 'categories'],
  benefits: ['jobs', 'benefits'],
  languages: ['jobs', 'languages'],
  skills: ['skills', 'catalog'],
  skillSearch: (query) => ['skills', 'search', query],
  industries: ['jobs', 'industries'],
  employerList: (params = {}) => ['jobs', 'employer-list', params],
  employerDetail: (publicId) => ['jobs', 'employer-detail', publicId],
  candidateRecommendationsRoot: ['jobs', 'candidate-recommendations'],
  candidateRecommendations: (params = {}) => ['jobs', 'candidate-recommendations', params],
  inlineRecommendationsRoot: ['jobs', 'inline-recommendations'],
  inlineRecommendations: (params = {}) => ['jobs', 'inline-recommendations', params],
  postingContext: ['jobs', 'posting-context'],
  adminModeration: (params = {}) => ['jobs', 'admin-moderation', params],
}

export function isDefaultJobListQuery(query) {
  const [domain, kind, params] = query.queryKey
  if (domain !== 'jobs' || kind !== 'list') return false
  if (typeof params === 'string') {
    return !new URLSearchParams(params).get('ordering')
  }
  return !params?.ordering
}
