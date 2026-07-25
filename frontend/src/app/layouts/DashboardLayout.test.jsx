import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from './DashboardLayout'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/site-settings', () => ({
  BrandLogo: () => <span>Logo</span>,
}))

describe('DashboardLayout admin access', () => {
  beforeEach(() => useSession.mockReset())

  it('filters navigation with the shared permission policy', () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'moderator@example.com',
        admin_access: {
          is_superuser: false,
          permissions: ['job_moderation.view', 'site_setting.view'],
          primary_department: {
            code: 'job-moderation',
            name: 'Kiểm duyệt tin',
          },
          memberships: [{
            department: { code: 'job-moderation', name: 'Kiểm duyệt tin' },
            role: { code: 'staff', name: 'Nhân viên', rank: 10 },
          }],
        },
      },
      logout: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/admin/app/job-moderation']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    expect(screen.getByText('Duyệt tin tuyển dụng')).toBeInTheDocument()
    expect(screen.getByText('Quyền của tôi')).toBeInTheDocument()
    expect(screen.queryByText('Cài đặt hệ thống')).not.toBeInTheDocument()
    expect(screen.getByText('Kiểm duyệt tin · Nhân viên')).toBeInTheDocument()
  })

  it('shows a useful empty state for an unassigned admin', () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'new-admin@example.com',
        admin_access: {
          is_superuser: false,
          permissions: [],
          primary_department: null,
          memberships: [],
        },
      },
      logout: vi.fn(),
    })
    render(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Liên hệ quản trị hệ thống/)).toBeInTheDocument()
  })
})
