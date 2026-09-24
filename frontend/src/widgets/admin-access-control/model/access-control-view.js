export function pagedResults(data) {
  const results = Array.isArray(data) ? data : (data?.results || [])
  return {
    count: Number.isFinite(data?.count) ? data.count : results.length,
    next: data?.next || null,
    previous: data?.previous || null,
    results,
  }
}

export const STAFF_DEFAULT_ORDERING = '-assigned_at'
export const STAFF_DEFAULT_STATUS = 'active'

export const STAFF_ORDERING_FIELDS = [
  'user__full_name',
  'role__department__name',
  'role__name',
  'user__two_factor_enabled',
  'is_active',
  'assigned_at',
]

const STAFF_STATUSES = new Set(['active', 'revoked', 'all'])
const STAFF_ORDERINGS = new Set(STAFF_ORDERING_FIELDS.flatMap((field) => [field, `-${field}`]))
const STAFF_QUERY_KEYS = {
  q: 'staff_q',
  department: 'staff_department',
  role: 'staff_role',
  status: 'staff_status',
  ordering: 'staff_ordering',
  page: 'staff_page',
}

function positivePage(value) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function staffListStateFromSearchParams(searchParams) {
  const status = searchParams.get(STAFF_QUERY_KEYS.status) || STAFF_DEFAULT_STATUS
  const ordering = searchParams.get(STAFF_QUERY_KEYS.ordering) || STAFF_DEFAULT_ORDERING
  return {
    q: searchParams.get(STAFF_QUERY_KEYS.q) || '',
    department: searchParams.get(STAFF_QUERY_KEYS.department) || '',
    role: searchParams.get(STAFF_QUERY_KEYS.role) || '',
    status: STAFF_STATUSES.has(status) ? status : STAFF_DEFAULT_STATUS,
    ordering: STAFF_ORDERINGS.has(ordering) ? ordering : STAFF_DEFAULT_ORDERING,
    page: positivePage(searchParams.get(STAFF_QUERY_KEYS.page)),
  }
}

export function staffMembershipParams(state, deferredQuery = state.q) {
  return {
    page: state.page,
    status: state.status,
    ordering: state.ordering,
    ...(deferredQuery.trim() ? { q: deferredQuery.trim() } : {}),
    ...(state.department ? { department: state.department } : {}),
    ...(state.role ? { role: state.role } : {}),
  }
}

export function withStaffListSearchParams(searchParams, patch) {
  const next = new URLSearchParams(searchParams)
  const state = {
    ...staffListStateFromSearchParams(searchParams),
    ...patch,
  }
  if (Object.keys(patch).some((key) => key !== 'page')) state.page = 1

  Object.values(STAFF_QUERY_KEYS).forEach((key) => next.delete(key))
  if (state.q) next.set(STAFF_QUERY_KEYS.q, state.q)
  if (state.department) next.set(STAFF_QUERY_KEYS.department, state.department)
  if (state.role) next.set(STAFF_QUERY_KEYS.role, state.role)
  if (state.status !== STAFF_DEFAULT_STATUS) next.set(STAFF_QUERY_KEYS.status, state.status)
  if (state.ordering !== STAFF_DEFAULT_ORDERING) {
    next.set(STAFF_QUERY_KEYS.ordering, state.ordering)
  }
  if (state.page > 1) next.set(STAFF_QUERY_KEYS.page, String(state.page))
  return next
}

export function activeRoleOptions(departments, roles, excludedRolePublicId = '') {
  return departments
    .filter((department) => department.is_active)
    .map((department) => ({
      label: department.name,
      options: roles
        .filter((role) => (
          role.is_active
          && role.public_id !== excludedRolePublicId
          && role.department.public_id === department.public_id
        ))
        .map((role) => ({ value: role.public_id, label: role.name })),
    }))
    .filter((group) => group.options.length > 0)
}

export const IMPACT_COPY = {
  departmentStatus: { title: 'Xác nhận đổi trạng thái phòng ban', ok: 'Xác nhận đổi trạng thái' },
  roleStatus: { title: 'Xác nhận đổi trạng thái chức danh', ok: 'Xác nhận đổi trạng thái' },
  rolePermissions: { title: 'Xác nhận thay đổi quyền', ok: 'Lưu thay đổi quyền' },
  assignment: { title: 'Xác nhận thay đổi chức danh', ok: 'Xác nhận thay đổi' },
  revoke: { title: 'Xác nhận thu hồi chức danh', ok: 'Thu hồi chức danh' },
  departmentRestore: { title: 'Khôi phục phòng ban mặc định', ok: 'Khôi phục mặc định' },
  roleRestore: { title: 'Khôi phục chức danh mặc định', ok: 'Khôi phục mặc định' },
}
