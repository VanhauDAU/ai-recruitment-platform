export const applicationKeys = {
  all: ['applications'],
  candidateList: ['applications', 'candidate-list'],
  recruiterList: (params = {}) => ['applications', 'recruiter-list', params],
  recruiterSnapshot: (publicId) => ['applications', 'recruiter-snapshot', publicId],
  history: (publicId) => ['applications', 'history', publicId],
}
