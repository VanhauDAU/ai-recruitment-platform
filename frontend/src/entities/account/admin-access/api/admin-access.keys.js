const root = ['admin-access']

export const adminAccessKeys = {
  all: root,
  auditLogs: (params = {}) => [...root, 'audit-logs', params],
}
