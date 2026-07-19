import { render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerGeneralSettings from './EmployerGeneralSettings'

const { mocks, useSession } = vi.hoisted(() => ({
  useSession: vi.fn(),
  mocks: {
    confirmEmployerTotpSetup: vi.fn(), confirmTwoFactorDisable: vi.fn(), confirmTwoFactorSetup: vi.fn(),
    disableEmployerTotp: vi.fn(), disableEmployerTwoFactorMethod: vi.fn(), generateEmployerBackupCodes: vi.fn(), sendEmployerBackupCodesCode: vi.fn(),
    sendEmployerMethodDisableCode: vi.fn(),
    sendTwoFactorDisableCode: vi.fn(), sendTwoFactorSetupCode: vi.fn(), startEmployerTotpSetup: vi.fn(),
  },
}))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/features/two-factor', () => ({
  ...mocks,
}))

function renderSettings() {
  return render(
    <App>
      <EmployerGeneralSettings />
    </App>,
  )
}

describe('EmployerGeneralSettings', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

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

    // "Đang hoạt động" is the notification card's badge; the 2FA card uses "Đang bật".
    expect(screen.getByText('Thông báo CV ứng tuyển').closest('div').parentElement).toHaveTextContent('Đang hoạt động')
    expect(screen.getByText('Xác thực 2 yếu tố').parentElement).toHaveTextContent('Đang bật')
    expect(screen.queryByText(/Vui lòng bật tính năng Xác thực bảo mật/)).not.toBeInTheDocument()
  })

  it('shows the three-step TOTP setup dialog with QR and manual key', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: false }, setCurrentUser: vi.fn() })
    mocks.startEmployerTotpSetup.mockResolvedValue({
      otpauth_url: 'otpauth://totp/TopCV?secret=BQ7MQ77SM54DO4XUMUZZ5OMDUP2G2WWJ', manual_key: 'BQ7MQ77SM54DO4XUMUZZ5OMDUP2G2WWJ', expires_in: 180,
    })

    renderSettings()
    const row = screen.getByText('Sử dụng Ứng dụng xác thực').closest('.flex.items-center')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Bật xác thực 2 yếu tố')).toBeInTheDocument()
    expect(screen.getByText('Mở ứng dụng xác thực')).toBeInTheDocument()
    expect(screen.getByText('Quét mã QR')).toBeInTheDocument()
    expect(screen.getByText('Nhập mã xác thực')).toBeInTheDocument()
    expect(screen.getByLabelText('Mã thiết lập thủ công')).toHaveTextContent('BQ7M Q77S M54D O4XU MUZZ 5OMD UP2G 2WWJ')
    expect(screen.getByRole('button', { name: 'Sao chép mã' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled()
  })

  it('confirms the TOTP setup when Enter is pressed after entering six digits', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: false }, setCurrentUser: vi.fn() })
    mocks.startEmployerTotpSetup.mockResolvedValue({
      otpauth_url: 'otpauth://totp/TopCV?secret=ABC123', manual_key: 'ABC123', expires_in: 180,
    })
    mocks.confirmEmployerTotpSetup.mockResolvedValue({ email: 'hr@example.com', two_factor_enabled: true, two_factor_totp_enabled: true })

    renderSettings()
    const row = screen.getByText('Sử dụng Ứng dụng xác thực').closest('.flex.items-center')
    await user.click(within(row).getByRole('switch'))
    await screen.findByText('Bật xác thực 2 yếu tố')

    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('123456{Enter}')

    await waitFor(() => expect(mocks.confirmEmployerTotpSetup).toHaveBeenCalledWith('123456'))
  })

  it('lets a TOTP-only employer create backup codes with an authenticator code', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_email_enabled: false, two_factor_totp_enabled: true }, setCurrentUser: vi.fn() })
    mocks.generateEmployerBackupCodes.mockResolvedValue({
      email: 'hr@example.com', two_factor_email_enabled: false, two_factor_totp_enabled: true, backup_codes: ['12345678'],
    })

    renderSettings()
    const row = screen.getByText('Sử dụng Mã dự phòng').closest('.flex.items-center')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Xác nhận tạo mã dự phòng')).toBeInTheDocument()
    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('123456')
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(mocks.generateEmployerBackupCodes).toHaveBeenCalledWith('123456', 'totp'))
  })

  it('uses TOTP first and offers email when creating backup codes with both methods enabled', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_email_enabled: true, two_factor_totp_enabled: true, two_factor_backup_codes_enabled: false }, setCurrentUser: vi.fn() })
    mocks.sendEmployerBackupCodesCode.mockResolvedValue({ email: 'hr@example.com', expires_in: 180 })

    renderSettings()
    const row = screen.getByText('Sử dụng Mã dự phòng').closest('.flex.items-center')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Xác nhận tạo mã dự phòng')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ứng dụng xác thực' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Nhận mã qua Email' }))

    await waitFor(() => expect(mocks.sendEmployerBackupCodesCode).toHaveBeenCalledOnce())
    expect(screen.getByText('hr@example.com')).toBeInTheDocument()
  })

  it('lets the employer switch to a backup code when disabling email', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_email_enabled: true, two_factor_totp_enabled: true, two_factor_backup_codes_enabled: true }, setCurrentUser: vi.fn() })
    mocks.disableEmployerTwoFactorMethod.mockResolvedValue({
      email: 'hr@example.com', two_factor_email_enabled: false, two_factor_totp_enabled: true, two_factor_backup_codes_enabled: true,
    })

    renderSettings()
    const row = screen.getByText('Sử dụng Email').closest('.flex.items-center')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Xác nhận tắt Email')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Mã dự phòng' }))
    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(8))
    const inputs = screen.getAllByRole('textbox')
    for (const [index, digit] of [...'12345678'].entries()) await user.type(inputs[index], digit)
    await expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(mocks.disableEmployerTwoFactorMethod).toHaveBeenCalledWith('email', 'backup', '12345678'))
  })
})
