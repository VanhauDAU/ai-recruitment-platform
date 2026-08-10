import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from './DashboardLayout'

const {
  getAdminAccountSummary,
  getAdminCompanySummary,
  getAdminEmployerVerificationSummary,
  useSession,
} = vi.hoisted(() => ({
  getAdminAccountSummary: vi.fn(),
  getAdminCompanySummary: vi.fn(),
  getAdminEmployerVerificationSummary: vi.fn(),
  useSession: vi.fn(),
}))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/admin-account', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminAccountSummary,
}))
vi.mock('@/entities/admin-company', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminCompanySummary,
}))
vi.mock('@/entities/admin-employer-verification', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminEmployerVerificationSummary,
}))
vi.mock('@/entities/site-settings', () => ({
  BrandLogo: () => <span>Logo</span>,
}))

function ThemeProbe() {
  const { token } = antdTheme.useToken()
  return <span data-testid="admin-primary-token">{token.colorPrimary}</span>
}

function renderDashboard(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

describe('DashboardLayout admin access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminAccountSummary.mockResolvedValue({
      totals: { restricted: 4 },
      queues: { pending_admin_invitations: 5 },
    })
    getAdminEmployerVerificationSummary.mockResolvedValue({ pending: 3 })
    getAdminCompanySummary.mockResolvedValue({
      verification: { pending: 6 },
      pending_update_requests: 7,
    })
  })

  it('filters navigation with the shared permission policy', async () => {
    const user = userEvent.setup()
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
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/job-moderation']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /^Tin tuyển dụng/ }))
    expect(screen.getByText('Tin chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('Tài khoản cá nhân')).toBeInTheDocument()
    expect(screen.queryByText('Hệ thống')).not.toBeInTheDocument()
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
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const homeButton = screen.getByRole('button', { name: 'Trang chủ' })
    const personalAccountButton = screen.getByRole('button', { name: 'Tài khoản cá nhân' })
    expect(homeButton).toHaveAttribute('aria-current', 'page')
    expect(homeButton).not.toHaveAttribute('aria-expanded')
    expect(personalAccountButton).not.toHaveAttribute('aria-expanded')
    const navigation = screen.getByRole('navigation', { name: 'Điều hướng quản trị' })
    expect(within(navigation).queryByText('Bảng điều khiển')).not.toBeInTheDocument()
    expect(screen.queryByText('Thông tin cá nhân')).not.toBeInTheDocument()

    expect(screen.getByText('Nội dung & dịch vụ')).toBeInTheDocument()
    expect(screen.queryByText('Danh mục')).not.toBeInTheDocument()

    await user.click(screen.getByText('Nội dung & dịch vụ'))
    await user.click(screen.getByText('Cẩm nang nghề nghiệp'))

    expect(await screen.findByText('Danh mục')).toBeInTheDocument()
    expect(screen.getByText('Bài viết')).toBeInTheDocument()
  })

  it('opens flyouts beside the selected group without duplicating its heading', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'superuser@example.com',
        admin_access: { is_superuser: true, permissions: [], memberships: [] },
      },
      logout: vi.fn(),
    })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByText('Nội dung & dịch vụ'))
    const guideButton = screen.getByRole('button', { name: /^Cẩm nang/ })
    vi.spyOn(guideButton, 'getBoundingClientRect').mockReturnValue({
      top: 240,
      bottom: 278,
      left: 0,
      right: 0,
      width: 0,
      height: 38,
      x: 0,
      y: 240,
      toJSON: () => ({}),
    })
    await user.click(guideButton)

    const flyout = screen.getByRole('complementary', { name: 'Cẩm nang nghề nghiệp' })
    expect(flyout).toHaveStyle({ '--admin-nav-flyout-top': '240px' })
    expect(screen.getAllByText('Cẩm nang nghề nghiệp')).toHaveLength(1)
  })

  it('keeps the auto-expand panel below the admin header brand area', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'superuser@example.com',
        admin_access: { is_superuser: true, permissions: [], memberships: [] },
      },
      logout: vi.fn(),
    })
    const { container } = renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Thu gọn thanh điều hướng' }))
    await user.hover(container.querySelector('.admin-sider'))

    const peek = container.querySelector('.admin-sider__peek')
    expect(peek).toBeInTheDocument()
    expect(peek.querySelector('.admin-sider__brand')).toBeNull()
    expect(screen.getAllByText('Logo')).toHaveLength(1)
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
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const contentSection = screen.getByRole('button', { name: /Nội dung & dịch vụ/ })
    const accountSection = screen.getByRole('button', { name: /Doanh nghiệp/ })
    await user.click(contentSection)
    expect(contentSection).toHaveAttribute('aria-expanded', 'true')

    await user.click(accountSection)
    expect(accountSection).toHaveAttribute('aria-expanded', 'true')
    expect(contentSection).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows compact queue counts in submenu items', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'superuser@example.com',
        admin_access: { is_superuser: true, permissions: [], memberships: [] },
      },
      logout: vi.fn(),
    })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const usersMenu = screen.getByRole('button', { name: /Người dùng/ })
    expect(
      await within(usersMenu).findByLabelText('5 mục đang chờ'),
    ).toHaveTextContent('5')

    const businessMenu = screen.getByRole('button', { name: /Doanh nghiệp/ })
    expect(
      await within(businessMenu).findByLabelText('16 mục đang chờ'),
    ).toHaveTextContent('16')
    await user.click(businessMenu)
    expect(within(businessMenu).queryByLabelText('16 mục đang chờ')).not.toBeInTheDocument()

    const recruiterMenu = screen.getByRole('button', { name: /^Nhà tuyển dụng/ })
    expect(within(recruiterMenu).getByLabelText('3 mục đang chờ')).toHaveTextContent('3')
    await user.click(recruiterMenu)
    expect(within(recruiterMenu).queryByLabelText('3 mục đang chờ')).not.toBeInTheDocument()

    const badge = await screen.findByLabelText('3 mục đang chờ')
    expect(badge).toHaveTextContent('3')
    expect(badge).toHaveClass('admin-nav__count')

    const restrictedRecruiters = screen.getByRole('button', { name: 'NTD bị hạn chế' })
    expect(restrictedRecruiters.querySelector('.admin-nav__count')).toBeNull()

    await user.click(usersMenu)
    expect(within(usersMenu).queryByLabelText('5 mục đang chờ')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Kiểm soát/ }))
    const restrictedUsers = screen.getByRole('button', { name: 'Người dùng bị hạn chế' })
    expect(restrictedUsers.querySelector('.admin-nav__count')).toBeNull()
  })

  it('shows the active third-level item in the workspace header', () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'superuser@example.com',
        admin_access: { is_superuser: true, permissions: [], memberships: [] },
      },
      logout: vi.fn(),
    })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/companies?tab=updates']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    expect(screen.getByText('Đang ở: Yêu cầu cập nhật')).toBeInTheDocument()
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
    renderDashboard(
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

    renderDashboard(
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

    renderDashboard(
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
