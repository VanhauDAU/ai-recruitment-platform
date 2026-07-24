export const campaignKeys = {
  all: ['campaigns'],
  list: (params = {}) => ['campaigns', 'list', params],
  detail: (publicId) => ['campaigns', 'detail', publicId],
  options: ['campaigns', 'options'],
  report: (publicId) => ['campaigns', 'report', publicId],
  pauseImpact: (publicId) => ['campaigns', 'pause-impact', publicId],
  activities: (publicId, params = {}) => ['campaigns', 'activities', publicId, params],
  jobPerformance: (publicId, days) => ['campaigns', 'job-performance', publicId, days],
}
