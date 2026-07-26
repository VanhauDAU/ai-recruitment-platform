import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AdminAccountAccessPanel from './AdminAccountAccessPanel'

const ACCOUNT = {
  role: 'admin',
  status: 'active',
  invitation: {
    status: 'accepted',
    invited_by_email: 'root@example.com',
    expires_at: '2026-07-30T08:00:00Z',
    accepted_at: '2026-07-27T08:00:00Z',
  },
  admin_access: {
    is_superuser: false,
    access_source: 'role',
    permissions: ['job_moderation.approve', 'job_moderation.view'],
    permission_count: 2,
    membership: {
      is_active: true,
      is_primary: true,
      assigned_at: '2026-07-20T08:00:00Z',
      assigned_by_name: 'System Admin',
      assigned_by_email: 'root@example.com',
      role: {
        code: 'moderator',
        name: 'Nhân viên kiểm duyệt',
        description: 'Kiểm tra các tin tuyển dụng.',
        rank: 10,
        is_active: true,
        is_system_managed: true,
        permission_codes: ['job_moderation.approve', 'job_moderation.view'],
        department: {
          code: 'job-moderation',
          name: 'Kiểm duyệt tin tuyển dụng',
          description: 'Đảm bảo chất lượng nội dung tuyển dụng.',
          is_active: true,
          is_system_managed: true,
        },
      },
    },
  },
}

describe('AdminAccountAccessPanel', () => {
  it('shows complete assignment and effective permissions', () => {
    render(<AdminAccountAccessPanel account={ACCOUNT} />)

    expect(screen.getByText('Nhân viên kiểm duyệt')).toBeInTheDocument()
    expect(screen.getByText('Kiểm duyệt tin tuyển dụng')).toBeInTheDocument()
    expect(screen.getByText('System Admin · root@example.com')).toBeInTheDocument()
    expect(screen.getByText('Duyệt tin tuyển dụng')).toBeInTheDocument()
    expect(screen.getByText('Xem tin chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('2 quyền')).toBeInTheDocument()
    expect(screen.getByText('Đã chấp nhận')).toBeInTheDocument()
  })

  it('explains unrestricted superuser access', () => {
    render(
      <AdminAccountAccessPanel
        account={{
          ...ACCOUNT,
          admin_access: {
            is_superuser: true,
            access_source: 'superuser',
            permissions: ['account.view'],
            permission_count: 1,
            membership: null,
          },
        }}
      />,
    )

    expect(screen.getByText('Toàn quyền Superuser')).toBeInTheDocument()
    expect(screen.getByText('Xem tài khoản người dùng')).toBeInTheDocument()
  })

  it('keeps an unknown effective permission visible', () => {
    render(
      <AdminAccountAccessPanel
        account={{
          ...ACCOUNT,
          invitation: null,
          admin_access: {
            is_superuser: false,
            permissions: ['legacy.custom'],
            permission_count: 1,
            membership: null,
          },
        }}
      />,
    )

    expect(screen.getByText('Chưa có chức danh hiệu lực')).toBeInTheDocument()
    expect(screen.getAllByText('legacy.custom').length).toBeGreaterThan(0)
    expect(screen.getByText('Quyền khác')).toBeInTheDocument()
  })
})
