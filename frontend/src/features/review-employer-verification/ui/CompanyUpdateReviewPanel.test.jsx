import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import CompanyUpdateReviewPanel from './CompanyUpdateReviewPanel'

const api = vi.hoisted(() => ({
  getAdminCompanyUpdateDocumentContent: vi.fn(),
  getAdminCompanyUpdateRequest: vi.fn(),
  refreshAdminCompanyUpdateTaxLookup: vi.fn(),
  reviewAdminCompanyUpdateDocument: vi.fn(),
  reviewAdminCompanyUpdateRequest: vi.fn(),
  startAdminCompanyUpdateReview: vi.fn(),
}))

vi.mock('@/entities/admin-employer-verification', () => ({
  adminEmployerVerificationKeys: {
    companyUpdate: (publicId) => ['admin-employer-verifications', 'company-update', publicId],
  },
  ...api,
}))

function renderPanel({ canReview = false, requestPublicId = 'cur_1' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <CompanyUpdateReviewPanel
          companyPublicId="co_1"
          requestPublicId={requestPublicId}
          requesterPublicId="usr_owner"
          canReview={canReview}
          canViewSensitive
        />
      </App>
    </QueryClientProvider>,
  )
}

describe('CompanyUpdateReviewPanel', () => {
  it('opens a compact old-versus-new comparison modal', async () => {
    api.getAdminCompanyUpdateRequest.mockResolvedValue({
      public_id: 'cur_1',
      company: { public_id: 'co_1', name: 'FPT Software', tax_code: '0101234567' },
      requested_by_email: 'hr@example.com',
      requested_by_public_id: 'usr_owner',
      status: 'submitted',
      revision: 2,
      lock_version: 0,
      created_at: '2026-07-25T10:00:00Z',
      updated_at: '2026-07-26T10:00:00Z',
      changes: {
        trade_name: 'FPT Digital',
        description: '<p>Mô tả mới</p>',
        industries: [2],
        primary_industry: 2,
        gallery_additions: ['employers/co_1/gallery/new-image.jpg'],
      },
      current_values: {
        trade_name: 'FPT Software',
        description: '<p>Mô tả cũ</p>',
        industries: [1],
        primary_industry: 1,
        gallery_additions: [],
      },
      industry_labels: { 1: 'Tài chính', 2: 'Công nghệ' },
      media_previews: {
        gallery_additions: ['http://localhost:8000/media/employers/co_1/gallery/new-image.jpg'],
      },
      is_sensitive: false,
      documents: [],
    })

    renderPanel()

    const openButton = await screen.findByRole('button', { name: /Xem chi tiết và đối chiếu/ })
    expect(api.getAdminCompanyUpdateRequest).toHaveBeenCalledWith(
      'cur_1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(screen.queryByText('FPT Digital')).not.toBeInTheDocument()
    await userEvent.click(openButton)

    const dialog = screen.getByRole('dialog', { name: 'Đối chiếu yêu cầu sửa thông tin công ty' })
    expect(within(dialog).getByRole('columnheader', { name: 'Hiện tại' })).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: 'Đề xuất mới' })).toBeInTheDocument()
    const tradeNameRow = within(dialog).getByRole('rowheader', { name: 'Tên thương mại' }).closest('[role="row"]')
    const industryRow = within(dialog).getByRole('rowheader', { name: 'Lĩnh vực' }).closest('[role="row"]')
    const descriptionRow = within(dialog).getByRole('rowheader', { name: 'Mô tả' }).closest('[role="row"]')
    expect(within(tradeNameRow).getByText('FPT Software')).toBeInTheDocument()
    expect(within(tradeNameRow).getByText('FPT Digital')).toBeInTheDocument()
    expect(within(industryRow).getByText('Tài chính')).toBeInTheDocument()
    expect(within(industryRow).getByText('Công nghệ')).toBeInTheDocument()
    expect(within(descriptionRow).getByText('Mô tả cũ')).toBeInTheDocument()
    expect(within(descriptionRow).getByText('Mô tả mới')).toBeInTheDocument()
    expect(within(dialog).getByText('1 ảnh mới · Nhấn vào ảnh để xem lớn')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'Ảnh thư viện thêm mới 1' })).toHaveAttribute(
      'src',
      'http://localhost:8000/media/employers/co_1/gallery/new-image.jpg',
    )
  })

  it('fails closed when the exact request does not belong to the opened account', async () => {
    api.getAdminCompanyUpdateRequest.mockResolvedValue({
      public_id: 'cur_other',
      company: { public_id: 'co_1', name: 'FPT Software' },
      requested_by_public_id: 'usr_other',
    })

    renderPanel({ requestPublicId: 'cur_other' })

    expect(await screen.findByText('Yêu cầu cập nhật không khớp tài khoản đang mở'))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xem chi tiết và đối chiếu/ }))
      .not.toBeInTheDocument()
  })

  it('does not expose review actions after the exact request was processed', async () => {
    api.getAdminCompanyUpdateRequest.mockResolvedValue({
      public_id: 'cur_done',
      company: { public_id: 'co_1', name: 'FPT Software' },
      requested_by_public_id: 'usr_owner',
      status: 'approved',
      status_label: 'Đã duyệt',
    })

    renderPanel({ canReview: true, requestPublicId: 'cur_done' })

    expect(await screen.findByText('Yêu cầu cập nhật đã được xử lý')).toBeInTheDocument()
    expect(screen.getByText('Trạng thái hiện tại: Đã duyệt.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xem chi tiết và đối chiếu/ }))
      .not.toBeInTheDocument()
  })

  it('shows the saved document revision reason after admin review', async () => {
    api.getAdminCompanyUpdateRequest.mockResolvedValue({
      public_id: 'cur_revision',
      company: { public_id: 'co_1', name: 'FPT Software', tax_code: '0101234567' },
      requested_by_email: 'hr@example.com',
      requested_by_public_id: 'usr_owner',
      status: 'changes_requested',
      revision: 1,
      lock_version: 1,
      created_at: '2026-07-26T10:00:00Z',
      updated_at: '2026-07-27T00:00:00Z',
      changes: { company_name: 'FPT Software 2' },
      current_values: { company_name: 'FPT Software' },
      industry_labels: {},
      is_sensitive: true,
      reason: 'Đổi tên theo đăng ký mới',
      proof_type: 'business_registration',
      proof_type_label: 'Giấy đăng ký doanh nghiệp',
      tax_lookup_evidence: {
        public_id: 'tle_1',
        provider: 'vietqr',
        status: 'found',
        workflow_revision: 1,
        tax_code: '0101234567',
        returned_tax_code: '0101234567',
        submitted_company_name: 'FPT Software 2',
        registered_name: 'FPT SOFTWARE 2',
        comparison: {
          tax_code: 'match',
          company_name: 'match',
        },
        completed_at: '2026-07-27T00:00:00Z',
      },
      documents: [{
        public_id: 'doc_business',
        doc_type: 'business_registration',
        doc_type_label: 'Giấy đăng ký doanh nghiệp',
        file_name: 'gpkd.pdf',
        version: 1,
        is_current: true,
        status: 'changes_requested',
        status_label: 'Cần bổ sung',
        review_note: 'Ảnh bị mờ, vui lòng tải bản rõ đủ bốn góc.',
      }],
    })

    renderPanel({ canReview: true, requestPublicId: 'cur_revision' })
    await userEvent.click(await screen.findByRole('button', { name: /Xem chi tiết và đối chiếu/ }))

    const dialog = screen.getByRole('dialog', { name: 'Đối chiếu yêu cầu sửa thông tin công ty' })
    expect(within(dialog).getByText('1 giấy tờ đang chờ nhà tuyển dụng bổ sung')).toBeInTheDocument()
    expect(within(dialog).getByText('Ảnh bị mờ, vui lòng tải bản rõ đủ bốn góc.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: /Xem dữ liệu đối chiếu/ }))
    expect(within(dialog).getByText('VietQR.io')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Khớp')).toHaveLength(2)
    expect(within(dialog).getByText('Cần bổ sung')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Đã yêu cầu bổ sung' }))
      .not.toBeInTheDocument()
  })

  it('keeps a base-data conflict visible and prevents repeated approval attempts', async () => {
    api.getAdminCompanyUpdateRequest.mockResolvedValue({
      public_id: 'cur_base_conflict',
      company: { public_id: 'co_1', name: 'FPT Software', tax_code: '0101234567' },
      requested_by_email: 'hr@example.com',
      requested_by_public_id: 'usr_owner',
      status: 'in_review',
      revision: 3,
      current_revision_public_id: 'cuv_base_conflict',
      lock_version: 28,
      created_at: '2026-07-26T10:00:00Z',
      updated_at: '2026-07-28T09:53:42Z',
      changes: { address: 'Đà Nẵng' },
      current_values: { address: 'Hà Nội' },
      industry_labels: {},
      is_sensitive: true,
      reason: 'Đổi mã số thuế theo giấy đăng ký mới',
      proof_type: 'business_registration',
      proof_type_label: 'Giấy đăng ký doanh nghiệp',
      documents: [{
        public_id: 'doc_business',
        doc_type: 'business_registration',
        doc_type_label: 'Giấy đăng ký doanh nghiệp',
        version: 1,
        is_current: true,
        status: 'approved',
        status_label: 'Đã duyệt',
        review_note: '',
      }],
    })
    api.reviewAdminCompanyUpdateRequest.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'company_update_base_conflict',
          message: 'Thông tin công ty đã thay đổi ở trường địa chỉ. Vui lòng tải lại trước khi duyệt.',
        },
      },
    })

    renderPanel({ canReview: true, requestPublicId: 'cur_base_conflict' })
    await userEvent.click(await screen.findByRole('button', { name: /Xem chi tiết và đối chiếu/ }))
    const dialog = screen.getByRole('dialog', { name: 'Đối chiếu yêu cầu sửa thông tin công ty' })
    const approveButton = within(dialog).getByRole('button', { name: 'Duyệt và áp dụng' })

    await userEvent.click(approveButton)

    expect(await within(dialog).findByText(/Thông tin công ty đã thay đổi/)).toBeInTheDocument()
    expect(approveButton).toBeDisabled()
    expect(api.reviewAdminCompanyUpdateRequest).toHaveBeenCalledWith(
      'cur_base_conflict',
      {
        decision: 'approved',
        note: '',
        lock_version: 28,
        revision_public_id: 'cuv_base_conflict',
      },
    )
  })
})
