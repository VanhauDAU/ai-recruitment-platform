import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAccountSecurityActions from './AdminAccountSecurityActions'

const mocks = vi.hoisted(() => ({
  changeAccountStatus: vi.fn(),
  getAccountResourceHoldImpact: vi.fn(),
  getAccountSessionsImpact: vi.fn(),
  getAccountStatusImpact: vi.fn(),
  releaseAccountResourceHolds: vi.fn(),
  revokeAccountSessions: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/entities/account/admin-account', () => ({
  adminAccountKeys: { all: ['admin-accounts'] },
  changeAccountStatus: mocks.changeAccountStatus,
  getAccountResourceHoldImpact: mocks.getAccountResourceHoldImpact,
  getAccountSessionsImpact: mocks.getAccountSessionsImpact,
  getAccountStatusImpact: mocks.getAccountStatusImpact,
  releaseAccountResourceHolds: mocks.releaseAccountResourceHolds,
  revokeAccountSessions: mocks.revokeAccountSessions,
}))
vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))

const account = {
  public_id: 'usr-status-1',
  full_name: 'Nguyễn Minh Anh',
  email: 'minhanh@example.com',
  role: 'employer',
  status: 'active',
  status_enforcement: { requires_resource_review: false },
}

function renderActions(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <App>
        <AdminAccountSecurityActions
          account={account}
          allowBan
          allowResourceRelease
          {...props}
        />
      </App>
    </QueryClientProvider>,
  )
}

describe('AdminAccountSecurityActions', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((value) => {
      if (typeof value?.mockReset === 'function') value.mockReset()
    })
    Object.values(mocks.message).forEach((method) => method.mockReset())
    mocks.changeAccountStatus.mockResolvedValue({})
  })

  it('previews the ban as the dialog opens and confirms in one click', async () => {
    mocks.getAccountStatusImpact.mockResolvedValue({
      before: { status: 'active' },
      after: { status: 'banned' },
      active_session_count: 2,
      sessions_will_be_revoked: true,
      effects: {
        campaigns: [{ status: 'active', policy_hold: '', count: 1 }],
        jobs: [{ status: 'active', policy_hold: '', count: 3 }],
        open_application_count: 4,
        affected_candidate_count: 3,
      },
      restoration_policy: 'Khôi phục nhiều bước.',
      can_apply: true,
      impact_token: 'impact-ban',
    })
    renderActions()

    expect(screen.getByRole('button', { name: /Tạm khóa tài khoản/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cấm tài khoản/ }))
    expect(await screen.findByText('Khôi phục nhiều bước.')).toBeInTheDocument()
    expect(mocks.getAccountStatusImpact).toHaveBeenCalledWith('usr-status-1', {
      status: 'banned',
      reason: '',
      enforcement_evidence: '',
      violation_category: '',
    })
    expect(screen.getByText('Đang hoạt động → Đã cấm')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cấm tài khoản' }))
    expect(await screen.findByText('Chọn nhóm vi phạm.')).toBeInTheDocument()
    expect(mocks.changeAccountStatus).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByLabelText('Nhóm vi phạm'))
    fireEvent.click(await screen.findByText('Vi phạm chính sách'))
    fireEvent.click(screen.getByText('Giả mạo doanh nghiệp'))
    fireEvent.change(screen.getByLabelText('Bằng chứng xử lý'), {
      target: { value: 'Ticket SEC-123 đã được đối chiếu bởi bộ phận an toàn.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cấm tài khoản' }))

    await waitFor(() => {
      expect(mocks.changeAccountStatus).toHaveBeenCalledWith(
        'usr-status-1',
        {
          status: 'banned',
          reason: 'Giả mạo doanh nghiệp',
          enforcement_evidence: 'Ticket SEC-123 đã được đối chiếu bởi bộ phận an toàn.',
          violation_category: 'policy',
        },
        'impact-ban',
      )
    })
    expect(mocks.getAccountStatusImpact).toHaveBeenLastCalledWith(
      'usr-status-1',
      expect.objectContaining({ reason: 'Giả mạo doanh nghiệp', violation_category: 'policy' }),
    )
    expect(mocks.message.success).toHaveBeenCalled()
  })

  it('stops for a second look when the impact changed after it was shown', async () => {
    mocks.getAccountSessionsImpact
      .mockResolvedValueOnce({ active_session_count: 1, can_apply: true, impact_token: 'first' })
      .mockResolvedValue({ active_session_count: 3, can_apply: true, impact_token: 'second' })
    mocks.revokeAccountSessions.mockResolvedValue({})
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: /Thu hồi mọi phiên/ }))
    expect(await screen.findByText('1')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Nghi lộ mật khẩu'))
    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Thu hồi phiên' })
    fireEvent.click(submit)

    expect(await screen.findByText('Tác động vừa thay đổi. Kiểm tra lại rồi xác nhận.')).toBeInTheDocument()
    expect(mocks.revokeAccountSessions).not.toHaveBeenCalled()
    fireEvent.click(submit)
    await waitFor(() => {
      expect(mocks.revokeAccountSessions).toHaveBeenCalledWith('usr-status-1', 'Nghi lộ mật khẩu', 'second')
    })
  })

  it('makes the banned recovery sequence explicit', () => {
    renderActions({
      account: {
        ...account,
        status: 'banned',
        status_enforcement: { requires_resource_review: true },
      },
    })

    expect(screen.getByRole('button', { name: /Bắt đầu khôi phục/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mở lại tài khoản/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rà soát & gỡ giữ tài nguyên/ }))
      .not.toBeInTheDocument()
  })
})
