const root = ['admin-accounts']

export const adminAccountKeys = {
  all: root,
  summary: (params = {}) => [...root, 'summary', params],
  list: (params = {}) => [...root, 'list', params],
  detail: (publicId) => [...root, 'detail', publicId],
  profile: (publicId, reveal = false) => [...root, 'profile', publicId, { reveal }],
  resource: (publicId, resource, page = 1) => [
    ...root,
    'resource',
    publicId,
    resource,
    page,
  ],
  sessions: (publicId) => [...root, 'sessions', publicId],
  activity: (publicId, { category = '', limit = 0 } = {}) => [
    ...root,
    'activity',
    publicId,
    { category, limit },
  ],
  invitations: (params = {}) => [...root, 'invitations', params],
}
