const root = ['admin-accounts']

export const adminAccountKeys = {
  all: root,
  summary: [...root, 'summary'],
  list: (params = {}) => [...root, 'list', params],
  detail: (publicId) => [...root, 'detail', publicId],
  sessions: (publicId) => [...root, 'sessions', publicId],
  activity: (publicId, page = 1) => [...root, 'activity', publicId, page],
  invitations: (params = {}) => [...root, 'invitations', params],
  availableRoles: [...root, 'available-roles'],
  provisioningScopes: [...root, 'provisioning-scopes'],
}
