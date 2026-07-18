import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmployerWorkspaceLayout from './EmployerWorkspaceLayout'

const { useSession, getEmployerProfile } = vi.hoisted(() => ({
  useSession: vi.fn(),
  getEmployerProfile: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      public_id: 'rec_sidebar',
      onboarding: {
        phone_verified: false,
        company_linked: false,
        business_doc_submitted: false,
        candidate_dpa_submitted: false,
        dpa_accepted: false,
      },
    },
    isSuccess: true,
  }),
}))
vi.mock('@/entities/employer-profile', () => ({ getEmployerProfile }))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/site-settings', () => ({
  BrandLogo: () => <span>ProCV</span>,
}))

describe('EmployerWorkspaceLayout', () => {
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
})
