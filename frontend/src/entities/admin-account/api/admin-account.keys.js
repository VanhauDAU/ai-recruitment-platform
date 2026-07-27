const root = ['admin-accounts']

export const adminAccountKeys = {
  all: root,
  summary: [...root, 'summary'],
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
  activity: (publicId, page = 1) => [...root, 'activity', publicId, page],
  invitations: (params = {}) => [...root, 'invitations', params],
  availableRoles: [...root, 'available-roles'],
  provisioningScopes: [...root, 'provisioning-scopes'],
}
