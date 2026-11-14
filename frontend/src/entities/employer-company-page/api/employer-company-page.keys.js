const root = ['employer', 'company', 'page']

export const employerCompanyPageKeys = {
  all: root,
  page: [...root, 'workspace'],
  pinnableJobs: (q = '') => [...root, 'pinnable-jobs', { q }],
  editors: [...root, 'editors'],
}
