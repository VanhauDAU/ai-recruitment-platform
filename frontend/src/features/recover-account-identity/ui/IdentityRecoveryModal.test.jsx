import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangeAccountEmailButton from './ChangeAccountEmailButton'
import ResetAccountMfaButton from './ResetAccountMfaButton'

const mocks = vi.hoisted(() => ({
  changeAccountEmail: vi.fn(),
  getAccountEmailImpact: vi.fn(),
  getAccountMfaResetImpact: vi.fn(),
  resetAccountMfa: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/entities/admin-account', () => ({
  AccountVerificationSummary: ({ account }) => account
    ? <div>{`Đối chiếu: ${account.full_name} · ${account.email} · ${account.public_id}`}</div>
    : null,
  adminAccountKeys: { all: ['admin-accounts'] },
  changeAccountEmail: mocks.changeAccountEmail,
  getAccountEmailImpact: mocks.getAccountEmailImpact,
  getAccountMfaResetImpact: mocks.getAccountMfaResetImpact,
  resetAccountMfa: mocks.resetAccountMfa,
}))
vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))

function renderWithQuery(ui) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <App>{ui}</App>
    </QueryClientProvider>,
  )
}

function fillAuditFields() {
  fireEvent.change(screen.getByLabelText('Lý do khôi phục'), {
    target: { value: 'Người dùng mất quyền truy cập danh tính cũ' },
  })
  fireEvent.change(screen.getByLabelText('Bằng chứng xác minh'), {
    target: { value: 'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.' },
  })
}

describe('Identity recovery actions', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((value) => {
      if (typeof value?.mockReset === 'function') value.mockReset()
    })
    Object.values(mocks.message).forEach((method) => method.mockReset())
    mocks.changeAccountEmail.mockResolvedValue({})
    mocks.resetAccountMfa.mockResolvedValue({})
  })

  it('validates, previews and confirms an email recovery', async () => {
    const onSuccess = vi.fn()
    mocks.getAccountEmailImpact.mockResolvedValue({
      before: { email: 'old@example.com' },
      after: { email: 'new@example.com' },
      active_session_count: 2,
      oauth_providers_to_revoke: ['google'],
      mfa_methods: { email: true, totp: false, backup_codes_remaining: 2 },
      password_reset_available: true,
      can_apply: true,
      impact_token: 'impact-email',
    })
    renderWithQuery(
      <ChangeAccountEmailButton
        account={{
          public_id: 'usr-1',
          full_name: 'Nguyễn Thu Linh',
          email: 'old@example.com',
        }}
        publicId="usr-1"
        onSuccess={onSuccess}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Đổi email đăng nhập/i }))
    expect(screen.getByText(
      'Đối chiếu: Nguyễn Thu Linh · old@example.com · usr-1',
    )).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))
    expect(await screen.findByText('Nhập email đăng nhập mới.')).toBeInTheDocument()
    expect(mocks.getAccountEmailImpact).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Email đăng nhập mới'), {
      target: { value: 'NEW@Example.com' },
    })
    fillAuditFields()
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))

    expect(await screen.findByText('old@example.com')).toBeInTheDocument()
    expect(mocks.getAccountEmailImpact).toHaveBeenCalledWith('usr-1', {
      email: 'new@example.com',
      reason: 'Người dùng mất quyền truy cập danh tính cũ',
      verification_evidence: 'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thực hiện' }))
    await waitFor(() => {
      expect(mocks.changeAccountEmail).toHaveBeenCalledWith(
        'usr-1',
        expect.objectContaining({ email: 'new@example.com' }),
        'impact-email',
      )
    })
    expect(onSuccess).toHaveBeenCalledWith({})
  })

  it('rejects short verification evidence before requesting a preview', async () => {
    renderWithQuery(<ResetAccountMfaButton publicId="usr-validation" />)

    fireEvent.click(screen.getByRole('button', { name: /Đặt lại MFA/i }))
    fireEvent.change(screen.getByLabelText('Lý do khôi phục'), {
      target: { value: 'Cần khôi phục tài khoản' },
    })
    fireEvent.change(screen.getByLabelText('Bằng chứng xác minh'), {
      target: { value: 'Quá ngắn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))

    expect(await screen.findByText('Bằng chứng xác minh cần có ít nhất 20 ký tự.'))
      .toBeInTheDocument()
    expect(mocks.getAccountMfaResetImpact).not.toHaveBeenCalled()
  })

  it('previews and confirms an MFA reset', async () => {
    mocks.getAccountMfaResetImpact.mockResolvedValue({
      methods_to_disable: { email: true, totp: true, backup_codes_remaining: 3 },
      active_session_count: 1,
      can_apply: true,
      impact_token: 'impact-mfa',
    })
    renderWithQuery(<ResetAccountMfaButton publicId="usr-2" />)

    fireEvent.click(screen.getByRole('button', { name: /Đặt lại MFA/i }))
    fillAuditFields()
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))

    expect(await screen.findByText(/Email, Ứng dụng xác thực, 3 mã dự phòng/))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thực hiện' }))

    await waitFor(() => {
      expect(mocks.resetAccountMfa).toHaveBeenCalledWith(
        'usr-2',
        {
          reason: 'Người dùng mất quyền truy cập danh tính cũ',
          verification_evidence: 'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
        },
        'impact-mfa',
      )
    })
  })

  it('reloads impact after a stale confirmation without retrying confirm', async () => {
    mocks.getAccountMfaResetImpact.mockResolvedValue({
      methods_to_disable: { email: true, totp: false, backup_codes_remaining: 0 },
      active_session_count: 1,
      can_apply: true,
      impact_token: 'impact-mfa',
    })
    mocks.resetAccountMfa.mockRejectedValue({ response: { status: 409 } })
    renderWithQuery(<ResetAccountMfaButton publicId="usr-3" />)

    fireEvent.click(screen.getByRole('button', { name: /Đặt lại MFA/i }))
    fillAuditFields()
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))
    await screen.findByText('MFA bị xóa')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thực hiện' }))

    await waitFor(() => {
      expect(mocks.getAccountMfaResetImpact).toHaveBeenCalledTimes(2)
    })
    expect(mocks.resetAccountMfa).toHaveBeenCalledTimes(1)
  })
})
