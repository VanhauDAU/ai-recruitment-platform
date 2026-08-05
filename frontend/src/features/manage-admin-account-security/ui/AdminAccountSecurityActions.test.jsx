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

vi.mock('@/entities/admin-account', () => ({
  AccountVerificationSummary: ({ account }) => (
    <div>{`Đối chiếu: ${account.full_name} · ${account.email} · ${account.public_id}`}</div>
  ),
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

  it('shows explicit actions and requires evidence before banning', async () => {
    mocks.getAccountStatusImpact.mockResolvedValue({
      active_session_count: 2,
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
    expect(screen.getByText(
      'Đối chiếu: Nguyễn Minh Anh · minhanh@example.com · usr-status-1',
    )).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động trước' }))
    expect(await screen.findByText('Chọn nhóm vi phạm.')).toBeInTheDocument()
    expect(mocks.getAccountStatusImpact).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByRole(
          'button',
          { name: /Xem tác động trước/ },
        ),
      ).toBeEnabled()
    })

    fireEvent.mouseDown(screen.getByLabelText('Nhóm vi phạm'))
    fireEvent.click(await screen.findByText('Vi phạm chính sách'))
    fireEvent.change(screen.getByLabelText('Lý do xử lý'), {
      target: { value: 'Cấm tài khoản do vi phạm quy định nền tảng.' },
    })
    fireEvent.change(screen.getByLabelText('Bằng chứng xác minh / xử lý'), {
      target: { value: 'Ticket SEC-123 đã được đối chiếu bởi bộ phận an toàn.' },
    })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole(
        'button',
        { name: /Xem tác động trước/ },
      ),
    )

    expect(await screen.findByText('Khôi phục nhiều bước.')).toBeInTheDocument()
    expect(mocks.getAccountStatusImpact).toHaveBeenCalledWith('usr-status-1', {
      status: 'banned',
      reason: 'Cấm tài khoản do vi phạm quy định nền tảng.',
      enforcement_evidence: 'Ticket SEC-123 đã được đối chiếu bởi bộ phận an toàn.',
      violation_category: 'policy',
    })

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Cấm tài khoản/ }),
    )
    await waitFor(() => {
      expect(mocks.changeAccountStatus).toHaveBeenCalledWith(
        'usr-status-1',
        expect.objectContaining({
          status: 'banned',
          violation_category: 'policy',
        }),
        'impact-ban',
      )
    })
  })

  it('makes the banned recovery sequence explicit', () => {
    renderActions({
      account: {
        ...account,
        status: 'banned',
        status_enforcement: { requires_resource_review: true },
      },
      allowSessions: false,
    })

    expect(screen.getByRole('button', { name: /Bắt đầu khôi phục/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mở lại tài khoản/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rà soát & gỡ giữ tài nguyên/ }))
      .not.toBeInTheDocument()
  })
})
