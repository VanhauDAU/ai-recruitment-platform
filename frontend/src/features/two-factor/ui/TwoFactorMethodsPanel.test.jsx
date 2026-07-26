import { render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TwoFactorMethodsPanel from './TwoFactorMethodsPanel'

const { mocks, useSession } = vi.hoisted(() => ({
  useSession: vi.fn(),
  mocks: {
    confirmTotpSetup: vi.fn(), confirmTwoFactorDisable: vi.fn(), confirmTwoFactorSetup: vi.fn(),
    disableMfaMethod: vi.fn(), generateBackupCodes: vi.fn(), sendBackupCodesCode: vi.fn(),
    sendMfaMethodDisableCode: vi.fn(),
    sendTwoFactorDisableCode: vi.fn(), sendTwoFactorSetupCode: vi.fn(), startTotpSetup: vi.fn(),
  },
}))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/site-settings', () => ({ useSiteSettings: () => ({ siteName: 'ProCV' }) }))
vi.mock('../api/two-factor.api', () => ({ ...mocks }))

function renderPanel(props) {
  return render(
    <App>
      <TwoFactorMethodsPanel {...props} />
    </App>,
  )
}

describe('TwoFactorMethodsPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('shows the security prompt and "Đang tắt" badge when 2FA is off', () => {
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: false }, setCurrentUser: vi.fn() })

    renderPanel()

    expect(screen.getByText('Xác thực 2 yếu tố')).toBeInTheDocument()
    expect(screen.getByText('Đang tắt')).toBeInTheDocument()
    expect(screen.getByText(/Vui lòng bật tính năng Xác thực bảo mật/)).toBeInTheDocument()
    expect(screen.getByText('Sử dụng Ứng dụng xác thực')).toBeInTheDocument()
    expect(screen.getByText('Sử dụng Email')).toBeInTheDocument()
    expect(screen.getByText('Sử dụng Mã dự phòng')).toBeInTheDocument()
  })

  it('hides the security prompt when 2FA email is already enabled', () => {
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: true }, setCurrentUser: vi.fn() })

    renderPanel()

    expect(screen.getByText('Xác thực 2 yếu tố').parentElement).toHaveTextContent('Đang bật')
    expect(screen.queryByText(/Vui lòng bật tính năng Xác thực bảo mật/)).not.toBeInTheDocument()
  })

  it('shows the three-step TOTP setup dialog with QR and manual key', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_enabled: false }, setCurrentUser: vi.fn() })
    mocks.startTotpSetup.mockResolvedValue({
      otpauth_url: 'otpauth://totp/ProCV?secret=BQ7MQ77SM54DO4XUMUZZ5OMDUP2G2WWJ', manual_key: 'BQ7MQ77SM54DO4XUMUZZ5OMDUP2G2WWJ', expires_in: 180,
    })

    renderPanel()
    const row = screen.getByTestId('two-factor-method-totp')
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
    mocks.startTotpSetup.mockResolvedValue({
      otpauth_url: 'otpauth://totp/ProCV?secret=ABC123', manual_key: 'ABC123', expires_in: 180,
    })
    mocks.confirmTotpSetup.mockResolvedValue({ email: 'hr@example.com', two_factor_enabled: true, two_factor_totp_enabled: true })

    renderPanel()
    const row = screen.getByTestId('two-factor-method-totp')
    await user.click(within(row).getByRole('switch'))
    await screen.findByText('Bật xác thực 2 yếu tố')

    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('123456{Enter}')

    await waitFor(() => expect(mocks.confirmTotpSetup).toHaveBeenCalledWith('123456'))
  })

  it('lets a TOTP-only account create backup codes with an authenticator code', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_email_enabled: false, two_factor_totp_enabled: true }, setCurrentUser: vi.fn() })
    mocks.generateBackupCodes.mockResolvedValue({
      email: 'hr@example.com', two_factor_email_enabled: false, two_factor_totp_enabled: true, backup_codes: ['12345678'],
    })

    renderPanel()
    const row = screen.getByTestId('two-factor-method-backup')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Xác nhận tạo mã dự phòng')).toBeInTheDocument()
    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('123456')
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(mocks.generateBackupCodes).toHaveBeenCalledWith('123456', 'totp'))
  })

  it('uses TOTP first and offers email when creating backup codes with both methods enabled', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_email_enabled: true, two_factor_totp_enabled: true, two_factor_backup_codes_enabled: false }, setCurrentUser: vi.fn() })
    mocks.sendBackupCodesCode.mockResolvedValue({ email: 'hr@example.com', expires_in: 180 })

    renderPanel()
    const row = screen.getByTestId('two-factor-method-backup')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Xác nhận tạo mã dự phòng')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ứng dụng xác thực' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Nhận mã qua Email' }))

    await waitFor(() => expect(mocks.sendBackupCodesCode).toHaveBeenCalledOnce())
    expect(screen.getByText('hr@example.com')).toBeInTheDocument()
  })

  it('lets the account switch to a backup code when disabling email', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'hr@example.com', two_factor_email_enabled: true, two_factor_totp_enabled: true, two_factor_backup_codes_enabled: true }, setCurrentUser: vi.fn() })
    mocks.disableMfaMethod.mockResolvedValue({
      email: 'hr@example.com', two_factor_email_enabled: false, two_factor_totp_enabled: true, two_factor_backup_codes_enabled: true,
    })

    renderPanel()
    const row = screen.getByTestId('two-factor-method-email')
    await user.click(within(row).getByRole('switch'))

    expect(await screen.findByText('Xác nhận tắt Email')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Mã dự phòng' }))
    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(8))
    const inputs = screen.getAllByRole('textbox')
    for (const [index, digit] of [...'12345678'].entries()) await user.type(inputs[index], digit)
    await expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(mocks.disableMfaMethod).toHaveBeenCalledWith('email', 'backup', '12345678'))
  })

  it('locks enabled methods but still allows enrolling when canDisableMethods is false', async () => {
    const user = userEvent.setup()
    useSession.mockReturnValue({ user: { email: 'root@example.com', two_factor_email_enabled: true, two_factor_totp_enabled: false }, setCurrentUser: vi.fn() })
    mocks.startTotpSetup.mockResolvedValue({ otpauth_url: 'otpauth://totp/ProCV?secret=ABC123', manual_key: 'ABC123', expires_in: 180 })

    renderPanel({ canDisableMethods: false })

    const emailSwitch = within(screen.getByTestId('two-factor-method-email')).getByRole('switch')
    expect(emailSwitch).toBeDisabled()

    // Phương thức chưa bật vẫn phải bật được — khoá chỉ áp cho việc hạ cấp.
    await user.click(within(screen.getByTestId('two-factor-method-totp')).getByRole('switch'))
    await waitFor(() => expect(mocks.startTotpSetup).toHaveBeenCalledOnce())
  })
})
