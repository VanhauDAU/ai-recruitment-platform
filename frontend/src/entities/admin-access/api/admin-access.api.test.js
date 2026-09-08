import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdminMemberships } from './admin-access.api'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get } }))

describe('admin access API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { count: 0, results: [] } })
  })

  it('maps the staff list contract to server query parameters', async () => {
    await getAdminMemberships({
      q: 'alpha',
      department: 'dept_ops',
      role: 'role_reviewer',
      status: 'all',
      ordering: 'user__full_name',
      page: 2,
    }, { signal: 'staff-signal' })

    expect(get).toHaveBeenCalledWith('/admin/memberships/', {
      params: {
        q: 'alpha',
        department: 'dept_ops',
        role: 'role_reviewer',
        status: 'all',
        ordering: 'user__full_name',
        page: 2,
      },
      signal: 'staff-signal',
    })
  })

  it('uses an active, newest-first first page by default', async () => {
    await getAdminMemberships()

    expect(get).toHaveBeenCalledWith('/admin/memberships/', {
      params: { page: 1, status: 'active', ordering: '-assigned_at' },
      signal: undefined,
    })
  })
})
