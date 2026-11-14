export const applicationKeys = {
  all: ['applications'],
  candidateList: ['applications', 'candidate-list'],
  recruiterLists: () => ['applications', 'recruiter-list'],
  recruiterList: (params = {}) => ['applications', 'recruiter-list', params],
  // Kept outside `recruiterLists()` so list cache patches never touch it.
  recruiterUnreadCount: () => ['applications', 'recruiter-unread-count'],
  recruiterSnapshot: (publicId) => ['applications', 'recruiter-snapshot', publicId],
  history: (publicId) => ['applications', 'history', publicId],
  reviewLinks: (publicId) => ['applications', 'review-links', publicId],
  reviews: (publicId) => ['applications', 'reviews', publicId],
  publicReview: (token) => ['applications', 'public-review', token],
  cvExport: (publicId, exportId) => ['applications', 'cv-export', publicId, exportId],
}
