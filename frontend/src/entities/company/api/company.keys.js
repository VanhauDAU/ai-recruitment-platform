export const companyKeys = {
  all: ['companies'],
  directoryRoot: ['companies', 'directory'],
  featured: (requestKey = 0) => ['companies', 'directory', 'featured', { requestKey }],
  search: (keyword) => ['companies', 'directory', 'search', { keyword }],
  detail: (slug) => ['companies', 'detail', slug],
  similar: (publicId) => ['companies', 'similar', publicId],
  jobFacets: (publicId) => ['companies', 'job-facets', publicId],
}
