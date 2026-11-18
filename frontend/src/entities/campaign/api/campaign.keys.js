export const campaignKeys = {
  all: ['campaigns'],
  list: (params = {}) => ['campaigns', 'list', params],
  detail: (publicId) => ['campaigns', 'detail', publicId],
  options: ['campaigns', 'options'],
  report: (publicId) => ['campaigns', 'report', publicId],
  launch: (publicId) => ['campaigns', 'launch', publicId],
  pauseImpact: (publicId) => ['campaigns', 'pause-impact', publicId],
  activities: (publicId, params = {}) => ['campaigns', 'activities', publicId, params],
  jobPerformance: (publicId, days, jobPublicId = '') => [
    'campaigns',
    'job-performance',
    publicId,
    days,
    jobPublicId || 'all',
  ],
}
