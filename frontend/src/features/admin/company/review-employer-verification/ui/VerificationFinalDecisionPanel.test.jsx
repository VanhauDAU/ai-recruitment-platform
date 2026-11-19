import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerificationFinalDecisionPanel from './VerificationFinalDecisionPanel'

const api = vi.hoisted(() => ({
  changeAdminEmployerVerificationLifecycle: vi.fn(),
  decideAdminEmployerVerification: vi.fn(),
  getAdminEmployerDecisionImpact: vi.fn(),
  getAdminEmployerLifecycleImpact: vi.fn(),
  unlockAdminEmployerVerificationResubmission: vi.fn(),
  getAdminEmployerVerifications: vi.fn(),
}))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}))

vi.mock('@/entities/company/admin-employer-verification', () => ({
  ...api,
  CASE_DECISION_REASONS: { changes_requested: ['Cần bổ sung giấy tờ còn thiếu'] },
  adminEmployerVerificationKeys: { list: (params) => ['admin-employer-verifications', 'list', params] },
  verificationStatusMeta: (status) => ({ label: status, color: 'blue' }),
}))

vi.mock('@/shared/lib/toast', () => ({
  message: { success: vi.fn(), error: vi.fn() },
}))

const approvedImpact = {
  impact_token: 'decision-token',
  tax_advisory: { status: 'matched' },
  tax_override: false,
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
  taxEvidence = {
    status: 'found',
    comparison: { tax_code: 'match', company_name: 'match' },
  },
  finalRejectionCount = 0,
  resubmissionLocked = false,
  onChanged = vi.fn(),
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
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
          taxEvidence={taxEvidence}
          onChanged={onChanged}
        />
      </App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onChanged }
}

describe('VerificationFinalDecisionPanel', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
  })

  it('previews on open, confirms in one click and offers the next case', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue(approvedImpact)
    api.decideAdminEmployerVerification.mockResolvedValue({ status: 'approved' })
    api.getAdminEmployerVerifications.mockResolvedValue({
      count: 4,
      results: [{ public_id: 'evc_2', user_public_id: 'usr_next' }],
    })
    const { onChanged } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Duyệt hồ sơ' })
    expect(await within(dialog).findByText('Khớp nguồn thuế')).toBeInTheDocument()
    expect(api.getAdminEmployerDecisionImpact).toHaveBeenCalledWith('evc_1', {
      decision: 'approved',
      reason: '',
      tax_override: false,
      tax_override_reason: '',
    })
    expect(within(dialog).getByText(/Chỉ áp dụng cho nhà tuyển dụng này/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Duyệt hồ sơ' }))
    expect(api.decideAdminEmployerVerification).toHaveBeenCalledWith('evc_1', {
      decision: 'approved',
      reason: '',
      tax_override: false,
      tax_override_reason: '',
      impact_token: 'decision-token',
    })
    expect(onChanged).toHaveBeenCalledTimes(1)

    await user.click(await screen.findByRole('button', { name: 'Hồ sơ tiếp theo (còn 4)' }))
    expect(navigate).toHaveBeenCalledWith('/admin/app/recruiters/usr_next?tab=verification', { state: null })
  })

  it('waits for the manual tax confirmation and requires its reason', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue({
      ...approvedImpact,
      tax_advisory: { status: 'mismatch' },
      tax_override: true,
    })
    renderPanel({ taxEvidence: { status: 'not_found' } })

    await user.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Duyệt hồ sơ' })
    expect(api.getAdminEmployerDecisionImpact).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', {
      name: 'Tôi đã đối chiếu giấy tờ gốc và chịu trách nhiệm duyệt thủ công',
    }))
    expect(await within(dialog).findByText('Duyệt thủ công')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Duyệt hồ sơ' }))
    expect(await within(dialog).findByText('Nhập căn cứ duyệt thủ công.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Căn cứ duyệt thủ công'), 'Đã đối chiếu hồ sơ gốc')
    await user.click(within(dialog).getByRole('button', { name: 'Duyệt hồ sơ' }))

    expect(api.getAdminEmployerDecisionImpact).toHaveBeenLastCalledWith('evc_1', {
      decision: 'approved',
      reason: '',
      tax_override: true,
      tax_override_reason: 'Đã đối chiếu hồ sơ gốc',
    })
    expect(api.decideAdminEmployerVerification).toHaveBeenCalled()
  })

  it('blocks final approval while tax lookup is pending', () => {
    renderPanel({ taxEvidence: { status: 'pending' } })

    expect(screen.getByRole('button', { name: 'Duyệt hồ sơ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Duyệt hồ sơ' })).toHaveAttribute(
      'title',
      'Đang chờ kết quả tra cứu thuế. Chưa thể duyệt hồ sơ.',
    )
  })

  it('shows lifecycle impact as soon as the dialog opens', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerLifecycleImpact.mockResolvedValue(lifecycleImpact)
    api.changeAdminEmployerVerificationLifecycle.mockResolvedValue({ status: 'revoked' })
    renderPanel({ status: 'approved' })

    await user.click(screen.getByRole('button', { name: 'Thu hồi xác thực' }))
    const dialog = screen.getByRole('dialog', { name: 'Thu hồi xác thực' })
    expect(await within(dialog).findByText('Tin bị ẩn khỏi trang công khai')).toBeInTheDocument()
    expect(api.getAdminEmployerLifecycleImpact).toHaveBeenCalledWith('evc_1', 'revoked', { reason: '' })

    await user.type(within(dialog).getByLabelText('Lý do'), 'Giấy ủy quyền không còn hiệu lực')
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi xác thực' }))
    expect(api.changeAdminEmployerVerificationLifecycle).toHaveBeenCalledWith('evc_1', 'revoked', {
      reason: 'Giấy ủy quyền không còn hiệu lực',
      impact_token: 'lifecycle-token',
    })
  })

  it('re-previews and waits for a second click when confirm reports a stale impact', async () => {
    const user = userEvent.setup()
    api.getAdminEmployerDecisionImpact.mockResolvedValue(approvedImpact)
    api.decideAdminEmployerVerification
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'admin_resource_changed' } } })
      .mockResolvedValue({ status: 'approved' })
    const { onChanged } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = screen.getByRole('dialog', { name: 'Duyệt hồ sơ' })
    await within(dialog).findByText('Khớp nguồn thuế')
    await user.click(within(dialog).getByRole('button', { name: 'Duyệt hồ sơ' }))

    expect(await within(dialog).findByText('Tác động vừa thay đổi. Kiểm tra lại rồi xác nhận.'))
      .toBeInTheDocument()
    expect(onChanged).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Duyệt hồ sơ' }))
    expect(api.decideAdminEmployerVerification).toHaveBeenCalledTimes(2)
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('explains that a rejected case can enter a new review after complete resubmission', () => {
    renderPanel({ status: 'rejected' })

    expect(screen.getByText('Đang chờ nhà tuyển dụng nộp lại')).toBeVisible()
  })

  it('identifies a resubmitted pending case and directs admin to review it again', () => {
    renderPanel({ status: 'pending', revision: 2 })

    expect(screen.getByText('NTD đã nộp lại lần 2 · nhận xử lý để ra quyết định')).toBeVisible()
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
      finalRejectionCount: 3,
      resubmissionLocked: true,
    })

    expect(screen.getByText('3/3')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Mở khóa nộp lại/ }))
    const dialog = screen.getByRole('dialog', { name: 'Mở khóa nộp lại' })
    await user.click(within(dialog).getByRole('button', { name: 'Mở khóa nộp lại' }))
    expect(await within(dialog).findByText('Nhập lý do.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Lý do'), 'Đã xác minh khiếu nại với bản gốc')
    await user.click(within(dialog).getByRole('button', { name: 'Mở khóa nộp lại' }))

    expect(api.unlockAdminEmployerVerificationResubmission).toHaveBeenCalledWith('evc_1', {
      reason: 'Đã xác minh khiếu nại với bản gốc',
      lock_version: 7,
    })
    expect(api.getAdminEmployerDecisionImpact).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })
})
