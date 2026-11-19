import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangeAccountEmailButton from './ChangeAccountEmailButton'

const mocks = vi.hoisted(() => ({
  changeAccountEmail: vi.fn(),
  getAccountEmailImpact: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/entities/account/admin-account', () => ({
  AccountVerificationSummary: ({ account }) => account
    ? <div>{`Đối chiếu: ${account.full_name} · ${account.email} · ${account.public_id}`}</div>
    : null,
  adminAccountKeys: { all: ['admin-accounts'] },
  changeAccountEmail: mocks.changeAccountEmail,
  getAccountEmailImpact: mocks.getAccountEmailImpact,
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
  })

  it('previews once email and evidence are filled, then confirms in one click', async () => {
    const onSuccess = vi.fn()
    mocks.getAccountEmailImpact.mockResolvedValue({
      before: { email: 'old@example.com' },
      after: { email: 'new@example.com' },
      active_session_count: 2,
      oauth_providers_to_revoke: ['google'],
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
    expect(screen.getByText('Đối chiếu: Nguyễn Thu Linh · old@example.com · usr-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đổi email' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Email đăng nhập mới'), {
      target: { value: 'NEW@Example.com' },
    })
    fillAuditFields()
    expect(await screen.findByText('new@example.com')).toBeInTheDocument()
    expect(mocks.getAccountEmailImpact).toHaveBeenCalledWith('usr-1', {
      email: 'new@example.com',
      reason: '',
      verification_evidence: 'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Đổi email' }))
    await waitFor(() => {
      expect(mocks.changeAccountEmail).toHaveBeenCalledWith(
        'usr-1',
        {
          email: 'new@example.com',
          reason: 'Người dùng mất quyền truy cập danh tính cũ',
          verification_evidence: 'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
        },
        'impact-email',
      )
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('does not preview or allow confirm while the evidence is too short', async () => {
    renderWithQuery(<ChangeAccountEmailButton publicId="usr-validation" />)

    fireEvent.click(screen.getByRole('button', { name: /Đổi email đăng nhập/i }))
    fireEvent.change(screen.getByLabelText('Email đăng nhập mới'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Bằng chứng xác minh'), {
      target: { value: 'Quá ngắn' },
    })

    expect(await screen.findByText('Cần ít nhất 20 ký tự.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đổi email' })).toBeDisabled()
    expect(mocks.getAccountEmailImpact).not.toHaveBeenCalled()
  })

  it('reloads impact after a stale confirmation without retrying confirm', async () => {
    mocks.getAccountEmailImpact.mockResolvedValue({
      before: { email: 'old@example.com' },
      after: { email: 'new@example.com' },
      active_session_count: 1,
      oauth_providers_to_revoke: [],
      password_reset_available: true,
      can_apply: true,
      impact_token: 'impact-email',
    })
    mocks.changeAccountEmail.mockRejectedValue({ response: { status: 409 } })
    renderWithQuery(<ChangeAccountEmailButton publicId="usr-3" />)

    fireEvent.click(screen.getByRole('button', { name: /Đổi email đăng nhập/i }))
    fireEvent.change(screen.getByLabelText('Email đăng nhập mới'), {
      target: { value: 'new@example.com' },
    })
    fillAuditFields()
    await screen.findByText('Phiên bị đăng xuất')
    fireEvent.click(screen.getByRole('button', { name: 'Đổi email' }))

    expect(await screen.findByText('Tác động vừa thay đổi. Kiểm tra lại rồi xác nhận.')).toBeInTheDocument()
    expect(mocks.getAccountEmailImpact).toHaveBeenCalledTimes(3)
    expect(mocks.changeAccountEmail).toHaveBeenCalledTimes(1)
  })
})
