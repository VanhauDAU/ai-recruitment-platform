import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from './DashboardLayout'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/site-settings', () => ({
  BrandLogo: () => <span>Logo</span>,
}))

function ThemeProbe() {
  const { token } = antdTheme.useToken()
  return <span data-testid="admin-primary-token">{token.colorPrimary}</span>
}

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
    expect(screen.getByText('Tài khoản của tôi')).toBeInTheDocument()
    expect(screen.queryByText('Cài đặt hệ thống')).not.toBeInTheDocument()
    expect(screen.getByText('Kiểm duyệt tin · Nhân viên')).toBeInTheDocument()
  })

  it('groups related administration routes into expandable navigation sections', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'superuser@example.com',
        admin_access: {
          is_superuser: true,
          permissions: [],
          memberships: [],
        },
      },
      logout: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    expect(screen.getByText('Nội dung & kiểm duyệt')).toBeInTheDocument()
    expect(screen.queryByText('Catalogue CV')).not.toBeInTheDocument()

    await user.click(screen.getByText('Nội dung & kiểm duyệt'))

    expect(await screen.findByText('Catalogue CV')).toBeInTheDocument()
    expect(screen.getByText('Duyệt tin tuyển dụng')).toBeInTheDocument()
  })

  it('keeps only one navigation section expanded at a time', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'superuser@example.com',
        admin_access: { is_superuser: true, permissions: [], memberships: [] },
      },
      logout: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const contentSection = screen.getByText('Nội dung & kiểm duyệt').closest('li')
    const accountSection = screen.getByText('Quản trị tài khoản').closest('li')
    await user.click(screen.getByText('Nội dung & kiểm duyệt'))
    expect(contentSection).toHaveClass('ant-menu-submenu-open')

    await user.click(screen.getByText('Quản trị tài khoản'))
    expect(accountSection).toHaveClass('ant-menu-submenu-open')
    expect(contentSection).not.toHaveClass('ant-menu-submenu-open')
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

  it('asks for confirmation before logging out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'admin@example.com',
        admin_access: {
          is_superuser: true,
          permissions: [],
          memberships: [],
        },
      },
      logout,
    })

    render(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))

    expect(await screen.findByText('Đăng xuất khỏi phiên này?')).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('inherits the primary color from the application theme', () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'admin@example.com',
        admin_access: {
          is_superuser: true,
          permissions: [],
          memberships: [],
        },
      },
      logout: vi.fn(),
    })

    render(
      <ConfigProvider theme={{ token: { colorPrimary: '#7c3aed' } }}>
        <MemoryRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<ThemeProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ConfigProvider>,
    )

    expect(screen.getByTestId('admin-primary-token')).toHaveTextContent('#7c3aed')
  })
})
