import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerificationFinalDecisionPanel from './VerificationFinalDecisionPanel'

const api = vi.hoisted(() => ({
  changeAdminEmployerVerificationLifecycle: vi.fn(),
  decideAdminEmployerVerification: vi.fn(),
  getAdminEmployerDecisionImpact: vi.fn(),
  getAdminEmployerLifecycleImpact: vi.fn(),
}))

vi.mock('@/entities/admin-employer-verification', () => ({
  ...api,
  verificationStatusMeta: (status) => ({ label: status, color: 'blue' }),
}))

vi.mock('@/shared/lib/toast', () => ({
  message: { success: vi.fn() },
}))

const approvedImpact = {
  impact_token: 'decision-token',
  tax_advisory: { status: 'matched' },
  tax_override: false,
  company_impact: { will_mark_verified: true, will_downgrade: false },
  capability_impact: {
    candidate_data_access: 'eligible_after_recompute',
    job_approval: 'eligible_after_recompute',
    job_workspace: 'unchanged',
  },
  verification_hold_impact: {
    hold_count: 0,
    campaign_count: 2,
    job_count: 3,
    active_jobs_to_unhide: 1,
  },
}

const lifecycleImpact = {
  impact_token: 'lifecycle-token',
  company_impact: { will_downgrade: false },
  capability_impact: {
    candidate_data_access: 'blocked',
    job_approval: 'blocked',
    job_workspace: 'unchanged',
    job_create_edit_submit: 'unchanged',
  },
  resources: {
    campaign_count: 2,
    job_count: 4,
    active_jobs_hidden_from_public: 3,
  },
}

function renderPanel({
  status = 'in_review',
  canReview = true,
  canRevoke = false,
  canTaxOverride = false,
  onChanged = vi.fn(),
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <VerificationFinalDecisionPanel
          verificationCase={{ public_id: 'evc_1', status }}
          canReview={canReview}
          canRevoke={canRevoke}
          canTaxOverride={canTaxOverride}
          onChanged={onChanged}
        />
      </App>
    </QueryClientProvider>,
  )
  return { onChanged }
}

describe('VerificationFinalDecisionPanel', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
  })

  it('previews impact before confirming a final approval', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue(approvedImpact)
    api.decideAdminEmployerVerification.mockResolvedValue({ status: 'approved' })
    const { onChanged } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Duyệt hồ sơ' })
    expect(within(dialog).queryByText(/override kết quả/)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Xem tác động' }))
    expect(api.getAdminEmployerDecisionImpact).toHaveBeenCalledWith('evc_1', {
      decision: 'approved',
      reason: '',
      tax_override: false,
      tax_override_reason: '',
    })
    expect(await within(dialog).findByText('Công ty sẽ được đánh dấu đã xác thực khi xác nhận.'))
      .toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận quyết định' }))
    expect(api.decideAdminEmployerVerification).toHaveBeenCalledWith('evc_1', {
      decision: 'approved',
      reason: '',
      tax_override: false,
      tax_override_reason: '',
      impact_token: 'decision-token',
    })
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('requires an audit reason when an authorized actor enables tax override', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue({
      ...approvedImpact,
      tax_advisory: { status: 'mismatch' },
      tax_override: true,
    })
    renderPanel({ canTaxOverride: true })

    await user.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Duyệt hồ sơ' })
    await user.click(within(dialog).getByRole('checkbox', {
      name: 'Cho phép override kết quả tra cứu thuế advisory',
    }))
    await user.click(within(dialog).getByRole('button', { name: 'Xem tác động' }))
    expect(await within(dialog).findByText('Nhập lý do override để lưu audit.'))
      .toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Lý do override mã số thuế'), 'Đã đối chiếu hồ sơ gốc')
    await user.click(within(dialog).getByRole('button', { name: 'Xem tác động' }))

    expect(api.getAdminEmployerDecisionImpact).toHaveBeenCalledWith('evc_1', {
      decision: 'approved',
      reason: '',
      tax_override: true,
      tax_override_reason: 'Đã đối chiếu hồ sơ gốc',
    })
  })

  it('shows lifecycle impact and keeps company status independent', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerLifecycleImpact.mockResolvedValue(lifecycleImpact)
    api.changeAdminEmployerVerificationLifecycle.mockResolvedValue({ status: 'revoked' })
    renderPanel({ status: 'approved', canReview: false, canRevoke: true })

    await user.click(screen.getByRole('button', { name: 'Thu hồi xác thực' }))
    const dialog = screen.getByRole('dialog', { name: 'Thu hồi xác thực' })
    await user.type(within(dialog).getByLabelText('Lý do / ghi chú audit'), 'Giấy ủy quyền không còn hiệu lực')
    await user.click(within(dialog).getByRole('button', { name: 'Xem tác động' }))

    expect(api.getAdminEmployerLifecycleImpact).toHaveBeenCalledWith(
      'evc_1',
      'revoked',
      { reason: 'Giấy ủy quyền không còn hiệu lực' },
    )
    expect(await within(dialog).findByText('Trạng thái pháp lý của công ty không bị hạ.'))
      .toBeInTheDocument()
    expect(within(dialog).getByText(/3 tin active sẽ bị ẩn/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận quyết định' }))
    expect(api.changeAdminEmployerVerificationLifecycle).toHaveBeenCalledWith(
      'evc_1',
      'revoked',
      {
        reason: 'Giấy ủy quyền không còn hiệu lực',
        impact_token: 'lifecycle-token',
      },
    )
  })

  it('fails closed and reloads when confirm reports a stale impact', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue(approvedImpact)
    api.decideAdminEmployerVerification.mockRejectedValue({
      response: { status: 409, data: { code: 'admin_resource_changed' } },
    })
    const { onChanged } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Duyệt hồ sơ' })
    await user.click(within(dialog).getByRole('button', { name: 'Xem tác động' }))
    await within(dialog).findByTestId('verification-impact-summary')
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận quyết định' }))

    expect(await within(dialog).findByText(/Hồ sơ hoặc tài nguyên đã thay đổi/))
      .toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Xem tác động' })).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('does not expose write actions to a view-only actor', () => {
    renderPanel({ canReview: false, canRevoke: false, canTaxOverride: false })

    expect(screen.queryByRole('button', { name: 'Duyệt hồ sơ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thu hồi xác thực' })).not.toBeInTheDocument()
  })
})
