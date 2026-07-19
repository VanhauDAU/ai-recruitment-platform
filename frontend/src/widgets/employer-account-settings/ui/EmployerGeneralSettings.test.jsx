import { render, screen } from '@testing-library/react'
import { App } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import EmployerGeneralSettings from './EmployerGeneralSettings'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/features/two-factor', () => ({
  confirmTwoFactorDisable: vi.fn(),
  confirmTwoFactorSetup: vi.fn(),
  sendTwoFactorDisableCode: vi.fn(),
  sendTwoFactorSetupCode: vi.fn(),
}))

function renderSettings() {
  return render(
    <App>
      <EmployerGeneralSettings />
    </App>,
  )
}

describe('EmployerGeneralSettings', () => {
  it('shows the security prompt and "Đang tắt" badge when 2FA is off', () => {
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: false }, setCurrentUser: vi.fn() })

    renderSettings()

    expect(screen.getByText('Thông báo CV ứng tuyển')).toBeInTheDocument()
    expect(screen.getByText('Xác thực 2 yếu tố')).toBeInTheDocument()
    expect(screen.getByText('Đang tắt')).toBeInTheDocument()
    expect(screen.getByText(/Vui lòng bật tính năng Xác thực bảo mật/)).toBeInTheDocument()
    expect(screen.getByText('Sử dụng Ứng dụng xác thực')).toBeInTheDocument()
    expect(screen.getByText('Sử dụng Email')).toBeInTheDocument()
    expect(screen.getByText('Sử dụng Mã dự phòng')).toBeInTheDocument()
  })

  it('hides the security prompt when 2FA email is already enabled', () => {
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: true }, setCurrentUser: vi.fn() })

    renderSettings()

    // "Đang hoạt động" appears for the notification card and the enabled 2FA card.
    expect(screen.getAllByText('Đang hoạt động').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/Vui lòng bật tính năng Xác thực bảo mật/)).not.toBeInTheDocument()
  })
})
