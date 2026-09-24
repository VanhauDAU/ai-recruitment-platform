import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCompanyDomainReview from './AdminCompanyDomainReview'

const api = vi.hoisted(() => ({
  decide: vi.fn(),
  detail: vi.fn(),
  impact: vi.fn(),
  list: vi.fn(),
  summary: vi.fn(),
}))
vi.mock('@/entities/admin-employer-verification', async (importOriginal) => ({
  ...await importOriginal(),
  decideAdminCompanyDomainClaim: api.decide,
  getAdminCompanyDomainClaim: api.detail,
  getAdminCompanyDomainClaimImpact: api.impact,
  getAdminCompanyDomainClaims: api.list,
  getAdminCompanyDomainClaimSummary: api.summary,
}))

function renderReview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <App>
      <QueryClientProvider client={client}>
        <AdminCompanyDomainReview canReview canRevoke />
      </QueryClientProvider>
    </App>,
  )
}

describe('AdminCompanyDomainReview', () => {
  beforeEach(() => {
    api.decide.mockReset().mockResolvedValue({ status: 'verified' })
    api.impact.mockReset().mockResolvedValue({
      action: 'approve_manual',
      status: 'pending',
      domain: 'company.vn',
      impact_token: 'signed-impact',
    })
    api.summary.mockReset().mockResolvedValue({
      total: 4,
      manual_pending: 1,
      dns_pending: 1,
      verified: 1,
      needs_attention: 1,
    })
    api.list.mockReset().mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'dmc_1',
        domain: 'company.vn',
        company_name: 'Công ty An Tâm',
        requested_by_email: 'hr@company.vn',
        requested_by_email_verified: true,
        requester_profile: { legal_status: 'approved' },
        company_tax_code: '0312345678',
        method: 'admin_manual',
        status: 'pending',
        manual_review_requested_at: '2026-08-13T08:00:00Z',
        lock_version: 3,
      }],
    })
    api.detail.mockReset().mockResolvedValue({
      public_id: 'dmc_1',
      domain: 'company.vn',
      company_name: 'Công ty An Tâm',
      company: 'co_1',
      company_tax_code: '0312345678',
      requested_by_email: 'hr@company.vn',
      requested_by_email_verified: true,
      requester_profile: { legal_status: 'approved', phone_verified: true },
      method: 'admin_manual',
      status: 'pending',
      txt_name: '_procv-verification.company.vn',
      events: [{
        public_id: 'dce_1',
        event_type: 'manual_review_requested',
        created_at: '2026-08-13T08:00:00Z',
        payload: {},
      }],
    })
  })

  it('requires a signed impact preview before applying manual approval', async () => {
    renderReview()

    await userEvent.click(await screen.findByRole('button', { name: /Duyệt thủ công/ }))
    await userEvent.type(screen.getByLabelText('Lý do quyết định'), 'Đã đối chiếu hồ sơ pháp lý hợp lệ.')
    await userEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))

    await waitFor(() => expect(api.impact).toHaveBeenCalledWith(
      'dmc_1',
      'approve_manual',
      'Đã đối chiếu hồ sơ pháp lý hợp lệ.',
    ))
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận duyệt' }))

    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('dmc_1', {
      action: 'approve_manual',
      reason: 'Đã đối chiếu hồ sơ pháp lý hợp lệ.',
      impactToken: 'signed-impact',
    }))
  })

  it('shows live queue metrics and opens the complete audit detail', async () => {
    renderReview()

    expect(await screen.findByText('Quản lý xác minh tên miền')).toBeVisible()
    expect(screen.getByText('Chờ duyệt thủ công')).toBeVisible()
    await userEvent.click(await screen.findByRole('button', { name: /Xem đầy đủ/ }))

    await waitFor(() => expect(api.detail).toHaveBeenCalledWith(
      'dmc_1',
      expect.objectContaining({ signal: expect.anything() }),
    ))
    expect(await screen.findByText('Lịch sử xử lý')).toBeVisible()
    expect(screen.getByText('Đã yêu cầu duyệt thủ công')).toBeVisible()
  })
})
