export const applicationKeys = {
  all: ['applications'],
  candidateList: ['applications', 'candidate-list'],
  recruiterList: (params = {}) => ['applications', 'recruiter-list', params],
  adminJobList: (jobPublicId, params = {}) => [
    'applications',
    'admin-job-list',
    jobPublicId,
    params,
  ],
  recruiterSnapshot: (publicId) => ['applications', 'recruiter-snapshot', publicId],
  history: (publicId) => ['applications', 'history', publicId],
}
