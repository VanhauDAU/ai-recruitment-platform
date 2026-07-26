const root = ['admin-access']

export const adminAccessKeys = {
  all: root,
  departments: [...root, 'departments'],
  roles: (department = '') => [...root, 'roles', { department }],
  permissions: (role = '') => [...root, 'permissions', { role }],
  memberships: (params = {}) => [...root, 'memberships', params],
  staff: (query = '') => [...root, 'staff', { query }],
}
