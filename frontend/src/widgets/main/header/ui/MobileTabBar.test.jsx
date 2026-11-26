import { fireEvent, render, screen, within } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileTabBar from './MobileTabBar'

const session = vi.hoisted(() => ({ value: {} }))
const promptLogin = vi.hoisted(() => vi.fn())
vi.mock('@/features/common/account/auth', () => ({ useLoginPrompt: () => ({ promptLogin }) }))
vi.mock('@/entities/account/session', () => ({ useSession: () => session.value }))
vi.mock('@/features/main/account/view-candidate-notifications', () => ({ CandidateNotificationBell: () => null }))

function renderTabBar(path = '/') {
  return render(
    <App>
      <MemoryRouter initialEntries={[path]}><MobileTabBar /></MemoryRouter>
    </App>,
  )
}

describe('MobileTabBar', () => {
  beforeEach(() => {
    promptLogin.mockReset()
    session.value = { user: null, isAuthenticated: false, logout: vi.fn() }
  })

  it('highlights the current section and features the create-CV shortcut', () => {
    const { unmount } = renderTabBar('/viec-lam')
    const nav = screen.getByRole('navigation', { name: 'Điều hướng nhanh' })

    expect(within(nav).getByRole('link', { name: 'Việc làm' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('link', { name: 'Tạo CV' })).toHaveAttribute('href', '/mau-cv')
    expect(document.body).toHaveClass('has-mobile-tab-bar')

    unmount()
    expect(document.body).not.toHaveClass('has-mobile-tab-bar')
  })

  it('scrolls back to the top when the current tab is tapped again', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    renderTabBar('/')
    const nav = screen.getByRole('navigation', { name: 'Điều hướng nhanh' })

    fireEvent.click(within(nav).getByRole('link', { name: 'Trang chủ' }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    scrollTo.mockClear()
    fireEvent.click(within(nav).getByRole('link', { name: 'Việc làm' }))
    expect(scrollTo).not.toHaveBeenCalled()
    scrollTo.mockRestore()
  })

  it('opens the in-place login popup for guests', async () => {
    renderTabBar()
    fireEvent.click(screen.getByRole('button', { name: 'Tài khoản' }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('button', { name: 'Đăng ký tài khoản' })).toBeInTheDocument()
    // Đăng nhập mở popup tại chỗ (đóng được) thay vì rời trang sang /login.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Đăng nhập' }))
    expect(promptLogin).toHaveBeenCalledTimes(1)
  })

  it('shows the candidate account menu for signed-in candidates', async () => {
    session.value = {
      user: { role: 'candidate', full_name: 'Nguyễn An', email: 'candidate@example.com' },
      isAuthenticated: true,
      logout: vi.fn(),
    }
    renderTabBar('/tai-khoan/doi-mat-khau')
    const accountTab = screen.getByRole('button', { name: 'Tài khoản' })
    fireEvent.click(accountTab)

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Nguyễn An')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Cá nhân & Bảo mật/ })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(within(sheet).getByRole('button', { name: /Đăng xuất/ }))
    expect(session.value.logout).toHaveBeenCalled()
  })
})
