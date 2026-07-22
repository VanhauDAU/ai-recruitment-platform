import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerWorkspaceLayout from './EmployerWorkspaceLayout'

const { useSession, getEmployerProfile, profileQueryState } = vi.hoisted(() => ({
  useSession: vi.fn(),
  getEmployerProfile: vi.fn(),
  profileQueryState: {
    data: undefined,
    isSuccess: true,
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => profileQueryState,
}))
vi.mock('@/entities/employer-profile', () => ({ getEmployerProfile }))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/site-settings', () => ({
  BrandLogo: () => <span>ProCV</span>,
}))

describe('EmployerWorkspaceLayout', () => {
  beforeEach(() => {
    profileQueryState.data = {
      public_id: 'rec_sidebar',
      onboarding: {
        email_verified: false,
        phone_verified: false,
        company_linked: false,
        business_doc_submitted: false,
        business_doc_approved: false,
        candidate_dpa_submitted: false,
        dpa_accepted: false,
      },
    }
  })

  it('temporarily opens the compact desktop icon rail on hover and collapses it when leaving', () => {
    useSession.mockReturnValue({
      user: { full_name: 'Nguyễn An', email: 'hr@example.com' },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route element={<EmployerWorkspaceLayout />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Bảng tin</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: 'Thu gọn menu quản trị' })
    fireEvent.click(toggle)

    const sidebar = screen.getByTestId('employer-sidebar')
    expect(sidebar).toHaveClass('ant-layout-sider-collapsed')
    expect(screen.getByRole('link', { name: 'Xem trạng thái xác thực tài khoản' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở menu quản trị' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.mouseEnter(sidebar)
    expect(sidebar).not.toHaveClass('ant-layout-sider-collapsed')
    expect(screen.getByText('Cấp 0/3')).toBeInTheDocument()

    fireEvent.mouseLeave(sidebar)
    expect(sidebar).toHaveClass('ant-layout-sider-collapsed')
  })

  it('shows the three-level account verification popover from the sidebar question mark', async () => {
    useSession.mockReturnValue({
      user: { full_name: 'Nguyễn An', email: 'hr@example.com' },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route element={<EmployerWorkspaceLayout />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Bảng tin</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Cấp 0/3')).toBeInTheDocument()
    const helpButton = screen.getByRole('button', { name: 'Xem chi tiết cấp xác thực tài khoản' })
    fireEvent.mouseEnter(helpButton)

    expect(await screen.findByText('Vui lòng thực hiện các bước xác thực dưới đây:')).toBeInTheDocument()
    expect(screen.getByText('Xác thực số điện thoại', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Cập nhật thông tin công ty', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Xác thực Giấy đăng ký doanh nghiệp', { exact: true })).toBeInTheDocument()
  })

  it('keeps the sidebar at level 1 while submitted business documents await approval', async () => {
    useSession.mockReturnValue({
      user: { full_name: 'Nguyễn An', email: 'hr@example.com' },
      logout: vi.fn(),
    })
    profileQueryState.data.onboarding = {
      ...profileQueryState.data.onboarding,
      email_verified: true,
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: true,
      business_doc_approved: false,
      no_report_history: true,
    }

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route element={<EmployerWorkspaceLayout />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Bảng tin</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Cấp 1/3')).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Xem chi tiết cấp xác thực tài khoản' }))

    expect(await screen.findByText('Hoàn thành')).toHaveTextContent('Hoàn thành 33%')
    const businessDocumentStep = screen.getByRole('link', {
      name: /Xác thực Giấy đăng ký doanh nghiệp/,
    })
    expect(businessDocumentStep.querySelector('.anticon-check-circle')).not.toBeInTheDocument()
  })

  it('opens the account information settings tab from the sidebar profile', () => {
    useSession.mockReturnValue({
      user: { full_name: 'Nguyễn An', email: 'hr@example.com' },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route element={<EmployerWorkspaceLayout />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Bảng tin</p>} />
            <Route path="/tuyendung/app/account/settings/account-info" element={<p>Thông tin tài khoản đang mở</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const accountLink = screen.getByRole('link', { name: 'Thông tin tài khoản' })
    expect(accountLink).toHaveAttribute('href', '/tuyendung/app/account/settings/account-info')
    fireEvent.click(accountLink)

    expect(screen.getByText('Thông tin tài khoản đang mở')).toBeInTheDocument()
  })

  it('does not show a candidate-portal shortcut in the employer account menu', async () => {
    useSession.mockReturnValue({
      user: { full_name: 'Nguyễn An', email: 'hr@example.com' },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route element={<EmployerWorkspaceLayout />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Bảng tin</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))

    await waitFor(() => expect(screen.getAllByText('Cài đặt tài khoản')).toHaveLength(2))
    expect(screen.queryByText('Về trang ứng viên')).not.toBeInTheDocument()
    expect(screen.getByText('Đăng xuất')).toBeInTheDocument()
  })
})
