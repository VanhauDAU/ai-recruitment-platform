export const campaignKeys = {
  all: ['campaigns'],
  list: (params = {}) => ['campaigns', 'list', params],
  detail: (publicId) => ['campaigns', 'detail', publicId],
  options: ['campaigns', 'options'],
  report: (publicId) => ['campaigns', 'report', publicId],
}
