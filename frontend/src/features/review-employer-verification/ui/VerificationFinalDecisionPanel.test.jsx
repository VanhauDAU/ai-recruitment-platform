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
  unlockAdminEmployerVerificationResubmission: vi.fn(),
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
  revision = 1,
  canReview = true,
  canRevoke = false,
  canTaxOverride = false,
  canUnlockResubmission = false,
  finalRejectionCount = 0,
  resubmissionLocked = false,
  onChanged = vi.fn(),
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <VerificationFinalDecisionPanel
          verificationCase={{
            public_id: 'evc_1',
            status,
            revision,
            lock_version: 7,
            final_rejection_count: finalRejectionCount,
            rejection_limit: 3,
            resubmission_locked_at: resubmissionLocked ? '2026-08-10T10:00:00Z' : null,
          }}
          canReview={canReview}
          canRevoke={canRevoke}
          canTaxOverride={canTaxOverride}
          canUnlockResubmission={canUnlockResubmission}
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

  it('explains that a rejected case can enter a new review after complete resubmission', () => {
    renderPanel({ status: 'rejected' })

    expect(screen.getByText('Đang chờ nhà tuyển dụng nộp lại')).toBeVisible()
    expect(screen.getByText(/Admin có thể nhận xử lý và ra quyết định cuối lần nữa/))
      .toBeVisible()
  })

  it('identifies a resubmitted pending case and directs admin to review it again', () => {
    renderPanel({ status: 'pending', revision: 2 })

    expect(screen.getByText('Nhà tuyển dụng đã nộp lại hồ sơ lần 2')).toBeVisible()
    expect(screen.getByText(/Hãy nhận xử lý lại ở phần đầu trang/)).toBeVisible()
  })

  it('warns before the third final rejection locks resubmission', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue({
      ...approvedImpact,
      decision: 'rejected',
      rejection_impact: {
        current_count: 2,
        next_count: 3,
        limit: 3,
        will_lock_resubmission: true,
      },
    })
    renderPanel({ finalRejectionCount: 2 })

    await user.click(screen.getByRole('button', { name: 'Từ chối hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Từ chối hồ sơ' })
    await user.type(within(dialog).getByLabelText('Lý do / ghi chú audit'), 'Bằng chứng không hợp lệ')
    await user.click(within(dialog).getByRole('button', { name: 'Xem tác động' }))

    expect(await within(dialog).findByText('3/3')).toBeInTheDocument()
    expect(within(dialog).getByText(/Xác nhận sẽ khóa nộp lại/)).toBeInTheDocument()
  })

  it('requires a reason and current lock version to unlock resubmission', async () => {
    const user = userEvent.setup()
    api.unlockAdminEmployerVerificationResubmission.mockResolvedValue({
      status: 'rejected',
      resubmission_locked: false,
    })
    const { onChanged } = renderPanel({
      status: 'rejected',
      canReview: false,
      canUnlockResubmission: true,
      finalRejectionCount: 3,
      resubmissionLocked: true,
    })

    expect(screen.getByText('3/3')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Mở khóa nộp lại/ }))
    const dialog = screen.getByRole('dialog', { name: 'Mở khóa nộp lại' })
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận mở khóa' }))
    expect(await within(dialog).findByText('Nhập lý do trước khi tiếp tục.'))
      .toBeInTheDocument()

    await user.type(
      within(dialog).getByLabelText('Lý do / ghi chú audit'),
      'Đã xác minh khiếu nại với bản gốc',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận mở khóa' }))

    expect(api.unlockAdminEmployerVerificationResubmission).toHaveBeenCalledWith('evc_1', {
      reason: 'Đã xác minh khiếu nại với bản gốc',
      lock_version: 7,
    })
    expect(api.getAdminEmployerDecisionImpact).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })
})
