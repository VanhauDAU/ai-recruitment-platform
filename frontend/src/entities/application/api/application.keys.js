export const applicationKeys = {
  all: ['applications'],
  candidateList: ['applications', 'candidate-list'],
  recruiterLists: () => ['applications', 'recruiter-list'],
  recruiterList: (params = {}) => ['applications', 'recruiter-list', params],
  // Kept outside `recruiterLists()` so list cache patches never touch it.
  recruiterUnreadCount: () => ['applications', 'recruiter-unread-count'],
  recruiterSnapshot: (publicId) => ['applications', 'recruiter-snapshot', publicId],
  history: (publicId) => ['applications', 'history', publicId],
  cvExport: (publicId, exportId) => ['applications', 'cv-export', publicId, exportId],
}
