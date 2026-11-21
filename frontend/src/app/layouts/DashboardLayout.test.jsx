import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from './DashboardLayout'

const {
  getAdminAccountSummary,
  getAdminQueueSummary,
  useSession,
} = vi.hoisted(() => ({
  getAdminAccountSummary: vi.fn(),
  getAdminQueueSummary: vi.fn(),
  useSession: vi.fn(),
}))
vi.mock('@/entities/account/session', () => ({ useSession }))
vi.mock('@/entities/account/admin-account', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminAccountSummary,
}))
vi.mock('@/entities/dashboard/admin-dashboard', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminQueueSummary,
}))
vi.mock('@/entities/system/site-settings', () => ({
  BrandLogo: () => <span>Logo</span>,
}))
vi.mock('@/widgets/common/announcement-strip', () => ({ AnnouncementStrip: () => null }))

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <span data-testid="location">{`${pathname}${search}`}</span>
}

const superuser = () => ({
  role: 'admin',
  email: 'superuser@example.com',
  admin_access: { is_superuser: true },
})

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
    window.localStorage.clear()
    getAdminAccountSummary.mockResolvedValue({
      totals: { restricted: 4 },
      queues: { pending_admin_invitations: 5 },
    })
    const queue = (key, count, overdue = 0) => ({
      key, count, overdue, oldest_at: '2026-11-15T08:00:00Z', sla_hours: 72,
    })
    getAdminQueueSummary.mockResolvedValue({
      generated_at: '2026-11-16T08:00:00Z',
      queues: [
        queue('recruiter_verification', 3),
        queue('domain_verification', 2),
        queue('company_updates', 7),
        queue('job_reports', 4, 1),
      ],
      knowledge_review_overdue: 0,
    })
  })

  it('hides superuser-only areas from a regular admin', async () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        full_name: 'Lan Kiểm Duyệt',
        email: 'moderator@example.com',
        admin_access: { is_superuser: false },
      },
      logout: vi.fn(),
    })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/job-moderation']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Điều hướng quản trị' })
    expect(within(navigation).getByRole('button', { name: 'Tin tuyển dụng' }))
      .toHaveAttribute('aria-expanded', 'true')
    expect(within(navigation).getByRole('link', { name: 'Tất cả tin' }))
      .toHaveAttribute('aria-current', 'page')
    expect(within(navigation).queryByText('Hệ thống')).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'Cấu hình hệ thống' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'Quản trị viên' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'Tất cả người dùng' })).not.toBeInTheDocument()
  })

  it('folds every destination into a few groups with the review queues open first', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: superuser(), logout: vi.fn() })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Điều hướng quản trị' })
    expect(within(navigation).getAllByRole('button', { expanded: false }).length
      + within(navigation).getAllByRole('button', { expanded: true }).length).toBe(6)
    expect(within(navigation).queryByText('Vận hành')).not.toBeInTheDocument()
    const home = within(navigation).getByRole('link', { name: 'Tổng quan' })
    expect(home).toHaveAttribute('href', '/admin/app/dashboard')
    expect(home).toHaveAttribute('aria-current', 'page')
    expect(within(navigation).getByRole('button', { name: 'Cần xử lý' }))
      .toHaveAttribute('aria-expanded', 'true')
    expect(within(navigation).getByRole('link', { name: 'Hậu kiểm nội dung' }))
      .toHaveAttribute('href', '/admin/app/companies?tab=content-changes')
    await user.click(within(navigation).getByRole('button', { name: 'Nội dung' }))
    expect(within(navigation).getByRole('link', { name: 'Mẫu CV' }))
      .toHaveAttribute('href', '/admin/app/cv/overview')
    expect(within(navigation).queryByText('Tài khoản cá nhân')).not.toBeInTheDocument()
  })

  it('opens one group at a time and remembers it', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: superuser(), logout: vi.fn() })
    const view = renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Doanh nghiệp' }))
    expect(screen.getByRole('button', { name: 'Cần xử lý' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'Người dùng' }))
    expect(screen.getByRole('button', { name: 'Doanh nghiệp' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Người dùng' })).toHaveAttribute('aria-expanded', 'true')
    view.unmount()

    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Cần xử lý' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Người dùng' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('remembers a collapsed sidebar and peeks below the brand area', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: superuser(), logout: vi.fn() })
    const view = renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Thu gọn thanh điều hướng' }))
    await user.hover(view.container.querySelector('.admin-sider'))
    const peek = view.container.querySelector('.admin-sider__peek')
    expect(peek).toBeInTheDocument()
    expect(peek.querySelector('.admin-sider__brand')).toBeNull()
    expect(screen.getAllByText('Logo')).toHaveLength(1)
    view.unmount()

    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toBeInTheDocument()
  })

  it('totals queue counts on the closed group and fades empty queues', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: superuser(), logout: vi.fn() })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Điều hướng quản trị' })
    const verification = within(navigation).getByRole('link', { name: /^Xác thực NTD/ })
    expect(await within(verification).findByLabelText('3 mục đang chờ')).toHaveClass('admin-nav__count')
    expect(within(navigation).getByRole('link', { name: /^Báo cáo tin/ }))
      .toContainElement(within(navigation).getByLabelText('4 mục đang chờ, có mục quá hạn'))
    expect(within(navigation).getByRole('link', { name: 'Báo cáo công ty' }))
      .toHaveClass('admin-nav__leaf--idle')

    // Opening another group closes the queues, which then show their total.
    await user.click(within(navigation).getByRole('button', { name: 'Hệ thống' }))
    expect(within(navigation).getByRole('link', { name: /Lời mời quản trị/ }))
      .toHaveTextContent('5')
    const queues = within(navigation).getByRole('button', { name: 'Cần xử lý' })
    expect(queues).toHaveAttribute('aria-expanded', 'false')
    expect(within(queues).getByLabelText('16 mục đang chờ, có mục quá hạn'))
      .toHaveClass('admin-nav__count--urgent')
    expect(within(navigation).getByRole('button', { name: 'Doanh nghiệp' })
      .querySelector('.admin-nav__count')).toBeNull()
    expect(await screen.findByRole('button', { name: '16 mục cần xử lý, 1 quá hạn' })).toBeInTheDocument()
  })

  it('shows the active queue in the workspace header', () => {
    useSession.mockReturnValue({ user: superuser(), logout: vi.fn() })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/companies?tab=updates']}>
        <DashboardLayout />
      </MemoryRouter>,
    )

    expect(screen.getByText('Đang ở: Cập nhật công ty')).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: 'Vị trí hiện tại' })
    expect(within(breadcrumb).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['Cần xử lý'])
  })

  it('jumps to any page from the keyboard palette', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: superuser(), logout: vi.fn() })
    renderDashboard(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <Routes>
          <Route path="*" element={<DashboardLayout />}>
            <Route path="*" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await user.keyboard('{Control>}k{/Control}')
    const search = await screen.findByRole('combobox', { name: 'Tìm trang quản trị' })
    await user.type(search, 'ten mien')
    expect(screen.getByRole('option', { name: /Xác minh tên miền/ }))
      .toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/app/recruiters?tab=domain-verification',
    )
  })

  it('labels a superuser in the workspace header', () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        full_name: 'Hậu Superuser',
        email: 'root@example.com',
        admin_access: { is_superuser: true },
      },
      logout: vi.fn(),
    })
    renderDashboard(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Superuser').length).toBeGreaterThan(0)
    expect(screen.getByText('Hậu Superuser', { selector: '.admin-sider-footer__meta strong' }))
      .toBeInTheDocument()
    expect(screen.queryByText(/chưa được gán phòng ban/)).not.toBeInTheDocument()
  })

  it('asks for confirmation before logging out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'admin@example.com',
        admin_access: { is_superuser: true },
      },
      logout,
    })

    renderDashboard(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))

    const confirmation = await screen.findByRole('dialog', { name: 'Đăng xuất' })
    expect(within(confirmation).getByText(/Bạn có chắc muốn đăng xuất khỏi phiên này/)).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()

    await user.click(within(confirmation).getByRole('button', { name: 'Đăng xuất' }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('inherits the primary color from the application theme', () => {
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        email: 'admin@example.com',
        admin_access: { is_superuser: true },
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
