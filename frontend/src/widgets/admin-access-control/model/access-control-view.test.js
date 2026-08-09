import { describe, expect, it } from 'vitest'
import {
  pagedResults,
  staffListStateFromSearchParams,
  staffMembershipParams,
  withStaffListSearchParams,
} from './access-control-view'

describe('access control staff list state', () => {
  it('preserves the server pagination envelope', () => {
    const response = {
      count: 45,
      next: '/api/admin/memberships/?page=3',
      previous: '/api/admin/memberships/?page=1',
      results: [{ public_id: 'membership_1' }],
    }

    expect(pagedResults(response)).toEqual(response)
    expect(pagedResults([{ public_id: 'staff_1' }])).toEqual({
      count: 1,
      next: null,
      previous: null,
      results: [{ public_id: 'staff_1' }],
    })
  })

  it('reads namespaced URL filters and builds backend parameters', () => {
    const searchParams = new URLSearchParams({
      tab: 'staff',
      staff_q: '  alpha  ',
      staff_department: 'dept_ops',
      staff_role: 'role_reviewer',
      staff_status: 'all',
      staff_ordering: 'user__full_name',
      staff_page: '3',
    })
    const state = staffListStateFromSearchParams(searchParams)

    expect(state).toEqual({
      q: '  alpha  ',
      department: 'dept_ops',
      role: 'role_reviewer',
      status: 'all',
      ordering: 'user__full_name',
      page: 3,
    })
    expect(staffMembershipParams(state)).toEqual({
      page: 3,
      status: 'all',
      ordering: 'user__full_name',
      q: 'alpha',
      department: 'dept_ops',
      role: 'role_reviewer',
    })
  })

  it('resets only the staff page when a filter changes and preserves other tabs', () => {
    const current = new URLSearchParams('tab=staff&staff_status=all&staff_page=4&audit_page=8')
    const next = withStaffListSearchParams(current, { ordering: 'role__name' })

    expect(next.get('tab')).toBe('staff')
    expect(next.get('audit_page')).toBe('8')
    expect(next.get('staff_status')).toBe('all')
    expect(next.get('staff_ordering')).toBe('role__name')
    expect(next.has('staff_page')).toBe(false)

    const paged = withStaffListSearchParams(next, { page: 2 })
    expect(paged.get('staff_page')).toBe('2')
  })

  it('falls back safely for unsupported URL status, ordering and page values', () => {
    const state = staffListStateFromSearchParams(new URLSearchParams({
      staff_status: 'deleted',
      staff_ordering: 'user__password',
      staff_page: '-3',
    }))

    expect(state).toMatchObject({
      status: 'active',
      ordering: '-assigned_at',
      page: 1,
    })
  })
})
