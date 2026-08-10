import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerDataProtectionForm from './EmployerDataProtectionForm'

const {
  acceptEmployerDpa,
  employerProfileKeys,
  getEmployerCompanyDocumentContent,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
} = vi.hoisted(() => ({
  acceptEmployerDpa: vi.fn(),
  employerProfileKeys: {
    companyDocuments: ['employer', 'company', 'documents'],
    companyDocumentList: (scope) => ['employer', 'company', 'documents', { scope }],
  },
  getEmployerCompanyDocumentContent: vi.fn(),
  getEmployerCompanyDocuments: vi.fn(),
  getEmployerProfile: vi.fn(),
  uploadEmployerDataProcessingAgreement: vi.fn(),
}))
const { message } = vi.hoisted(() => ({ message: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/entities/employer-profile', () => ({
  acceptEmployerDpa,
  employerProfileKeys,
  getEmployerCompanyDocumentContent,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
}))
vi.mock('@/entities/site-settings', () => ({ useSiteSettings: () => ({ siteName: 'TopCV' }) }))
vi.mock('@/shared/lib/toast', () => ({ message }))

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <App>
      <QueryClientProvider client={client}><EmployerDataProtectionForm /></QueryClientProvider>
    </App>,
  )
}

function stubObjectUrl(previewUrl) {
  const NativeURL = URL
  class MockURL extends NativeURL {}
  MockURL.createObjectURL = vi.fn(() => previewUrl)
  MockURL.revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', MockURL)
  return {
    createObjectURL: MockURL.createObjectURL,
    revokeObjectURL: MockURL.revokeObjectURL,
  }
}

describe('EmployerDataProtectionForm', () => {
  beforeEach(() => {
    acceptEmployerDpa.mockReset()
    getEmployerCompanyDocumentContent.mockReset()
    getEmployerCompanyDocuments.mockReset()
    getEmployerProfile.mockReset()
    uploadEmployerDataProcessingAgreement.mockReset()
    message.error.mockReset()
    message.success.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps both legal actions available before company information is updated', async () => {
    getEmployerProfile.mockResolvedValue({
      dpa_policy: {
        available: true,
        policy_version: 'test-dpa-v1',
        document_sha256: 'a'.repeat(64),
        document_url: 'https://example.test/dpa/test-dpa-v1',
      },
      onboarding: { company_linked: false, candidate_dpa_submitted: false, dpa_accepted: false },
    })
    getEmployerCompanyDocuments.mockResolvedValue([])
    uploadEmployerDataProcessingAgreement.mockResolvedValue({ id: 1 })
    acceptEmployerDpa.mockResolvedValue({})
    const user = userEvent.setup()
    const { container } = renderForm()

    expect(await screen.findByRole('heading', { name: /giữa Ứng viên - Nhà tuyển dụng/i })).toBeVisible()
    expect(getEmployerCompanyDocuments).toHaveBeenCalledWith({ scope: 'mine' })
    expect(screen.getByRole('link', { name: 'Tại đây' })).toHaveClass('!text-emerald-600')
    expect(screen.getByText('Tải mẫu văn bản').closest('a')).toHaveAttribute('href', '/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx')
    expect(screen.getByRole('link', { name: /Tải mẫu văn bản/ })).toHaveClass('!text-emerald-600')
    expect(screen.getByRole('link', { name: /Xem nội dung đầy đủ của văn bản/ })).toHaveClass('!text-emerald-600')
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()

    const input = container.querySelector('input[type="file"]')
    await user.upload(input, new File(['candidate agreement'], 'thoa-thuan.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    await user.click(screen.getByRole('checkbox', { name: /Tôi cam đoan văn bản này/i }))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(uploadEmployerDataProcessingAgreement).toHaveBeenCalledTimes(1))
    expect(message.success).toHaveBeenCalledWith('Thông báo', {
      description: 'Cập nhật thành công. TopCV đã nhận được giấy tờ của bạn và tiến hành xử lý sớm.',
    })

    await user.click(screen.getByRole('checkbox', { name: /Xác nhận đồng ý với các điều khoản/i }))
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(acceptEmployerDpa).toHaveBeenCalledWith({
      available: true,
      policy_version: 'test-dpa-v1',
      document_sha256: 'a'.repeat(64),
      document_url: 'https://example.test/dpa/test-dpa-v1',
    }))
  })

  it('fails closed when the current platform DPA is not versioned by the server', async () => {
    getEmployerProfile.mockResolvedValue({
      dpa_policy: {
        available: false,
        policy_version: '',
        document_sha256: '',
        document_url: '',
      },
      onboarding: { candidate_dpa_submitted: false, dpa_accepted: false },
    })
    getEmployerCompanyDocuments.mockResolvedValue([])
    renderForm()

    expect(await screen.findByText('Phiên bản thỏa thuận hiện hành chưa sẵn sàng')).toBeVisible()
    const checkbox = screen.getByRole('checkbox', {
      name: /Xác nhận đồng ý với các điều khoản/i,
    })
    expect(checkbox).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    expect(acceptEmployerDpa).not.toHaveBeenCalled()
  })

  it('opens a public DOCX in Google Viewer and only opens replacement controls on edit', async () => {
    getEmployerProfile.mockResolvedValue({
      dpa_accepted_at: '2026-07-19T15:28:37Z',
      onboarding: { company_linked: false, candidate_dpa_submitted: true, dpa_accepted: true },
    })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'data_processing_agreement',
      file_name: 'thoa-thuan.docx',
      file_url: 'https://files.example.com/thoa-thuan.docx',
      status: 'pending',
    }])
    const user = userEvent.setup()
    const { container } = renderForm()

    expect(await screen.findByText('Hệ thống đang xử lý')).toBeVisible()
    const documentLink = screen.getByRole('link', { name: 'Thỏa thuận xử lý DLCN' })
    expect(documentLink).toHaveAttribute('href', 'https://docs.google.com/gview?url=https%3A%2F%2Ffiles.example.com%2Fthoa-thuan.docx&embedded=true')
    expect(documentLink).toHaveClass('hover:!text-[var(--brand-primary)]')
    expect(screen.getByText('Văn bản mẫu')).toBeVisible()
    expect(screen.getByRole('link', { name: /Tải mẫu văn bản/ })).toBeVisible()
    expect(screen.queryByText('Chờ duyệt')).not.toBeInTheDocument()
    expect(screen.getByText('Bạn đã xác nhận vào 22:28:37 19/07/2026.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa văn bản' }))
    expect(screen.getByText('Chọn hoặc kéo tệp vào đây')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Tệp hiện tại: Thỏa thuận xử lý DLCN/ })).toHaveAttribute('href', 'https://docs.google.com/gview?url=https%3A%2F%2Ffiles.example.com%2Fthoa-thuan.docx&embedded=true')
    await user.upload(container.querySelector('input[type="file"]'), new File(['replacement'], 'thoa-thuan-moi.pdf', { type: 'application/pdf' }))
    expect(screen.getByText('Tệp mới: thoa-thuan-moi.pdf')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByText('Chọn hoặc kéo tệp vào đây')).not.toBeInTheDocument()
  })

  it('previews a selected PDF locally before it is uploaded', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: false, dpa_accepted: false },
    })
    getEmployerCompanyDocuments.mockResolvedValue([])
    const { createObjectURL } = stubObjectUrl('http://localhost/selected-pdf')
    const user = userEvent.setup()
    const { container } = renderForm()
    const file = new File(['%PDF-preview'], 'thoa-thuan.pdf', {
      type: 'application/pdf',
    })

    await screen.findByText('Chọn hoặc kéo tệp vào đây')
    await user.upload(container.querySelector('input[type="file"]'), file)
    await user.click(screen.getByRole('button', { name: 'Xem trước tệp thoa-thuan.pdf' }))

    const preview = await screen.findByTitle('Xem trước thoa-thuan.pdf')
    expect(preview).toHaveAttribute('src', 'http://localhost/selected-pdf')
    expect(createObjectURL).toHaveBeenCalledWith(file)
  })

  it('keeps a selected Word agreement local and offers a download preview', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: false, dpa_accepted: false },
    })
    getEmployerCompanyDocuments.mockResolvedValue([])
    const { createObjectURL } = stubObjectUrl('http://localhost/selected-word-preview')
    const user = userEvent.setup()
    const { container } = renderForm()
    const file = new File(['PK\u0003\u0004document'], 'thoa-thuan.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    await screen.findByText('Chọn hoặc kéo tệp vào đây')
    await user.upload(container.querySelector('input[type="file"]'), file)
    await user.click(screen.getByRole('button', { name: 'Xem trước tệp thoa-thuan.docx' }))

    const download = await screen.findByRole('link', { name: 'Tải tệp đã chọn' })
    expect(download).toHaveAttribute('href', 'http://localhost/selected-word-preview')
    expect(download).toHaveAttribute('download', 'thoa-thuan.docx')
    expect(createObjectURL).toHaveBeenCalledWith(file)
  })

  it('rejects an agreement larger than 5MB before submission', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: false, dpa_accepted: false },
    })
    getEmployerCompanyDocuments.mockResolvedValue([])
    const user = userEvent.setup()
    const { container } = renderForm()
    const oversizedFile = new File(
      [new Uint8Array((5 * 1024 * 1024) + 1)],
      'thoa-thuan-lon.pdf',
      { type: 'application/pdf' },
    )

    await screen.findByText('Chọn hoặc kéo tệp vào đây')
    await user.upload(container.querySelector('input[type="file"]'), oversizedFile)

    expect(message.error).toHaveBeenCalledWith(
      'Tệp "thoa-thuan-lon.pdf" vượt quá dung lượng tối đa 5MB.',
    )
    expect(screen.queryByText('Tệp mới: thoa-thuan-lon.pdf')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  })

  it('opens a private submitted document through the authenticated API client', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: true, dpa_accepted: true },
    })
    const privateDocument = {
      id: 19,
      doc_type: 'data_processing_agreement',
      file_url: 'http://localhost:8000/api/employer/company/documents/19/content/',
    }
    getEmployerCompanyDocuments.mockResolvedValue([privateDocument])
    getEmployerCompanyDocumentContent.mockResolvedValue(
      new Blob(['agreement'], { type: 'application/pdf' }),
    )
    const createObjectURL = vi.fn(() => 'blob:private-employer-document')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const previewWindow = {
      close: vi.fn(),
      location: { replace: vi.fn() },
      opener: null,
    }
    vi.spyOn(window, 'open').mockReturnValue(previewWindow)
    const user = userEvent.setup()

    renderForm()
    await user.click(await screen.findByRole('button', { name: 'Thỏa thuận xử lý DLCN' }))

    await waitFor(() => expect(getEmployerCompanyDocumentContent).toHaveBeenCalledWith(
      privateDocument,
    ))
    expect(screen.queryByRole('link', { name: 'Thỏa thuận xử lý DLCN' })).not.toBeInTheDocument()
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(previewWindow.location.replace).toHaveBeenCalledWith(
      'blob:private-employer-document',
    )
  })

  it('downloads a private DOCX with its extension instead of leaving a blank tab', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: true, dpa_accepted: true },
    })
    const privateDocument = {
      id: 19,
      doc_type: 'data_processing_agreement',
      file_name: 'Thỏa thuận xử lý DLCN',
      file_url: 'http://localhost:8000/api/employer/company/documents/19/content/',
    }
    getEmployerCompanyDocuments.mockResolvedValue([privateDocument])
    getEmployerCompanyDocumentContent.mockResolvedValue(new Blob(
      ['agreement'],
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    ))
    const createObjectURL = vi.fn(() => 'blob:private-employer-document')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const previewWindow = {
      close: vi.fn(),
      location: { replace: vi.fn() },
      opener: null,
    }
    vi.spyOn(window, 'open').mockReturnValue(previewWindow)
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()

    renderForm()
    await user.click(await screen.findByRole('button', { name: 'Thỏa thuận xử lý DLCN' }))

    await waitFor(() => expect(previewWindow.close).toHaveBeenCalled())
    expect(previewWindow.location.replace).not.toHaveBeenCalled()
    expect(downloadClick).toHaveBeenCalled()
  })

  it('shows an approved status after the candidate data agreement is reviewed', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: true, candidate_dpa_approved: true, dpa_accepted: true },
    })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'data_processing_agreement',
      file_url: 'https://files.example.com/thoa-thuan.pdf',
    }])

    renderForm()

    expect(await screen.findByText('Đã duyệt')).toBeVisible()
    expect(screen.queryByText('Hệ thống đang xử lý')).not.toBeInTheDocument()
  })

  it('shows a rejected agreement reason and resubmits it as a targeted replacement', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: {
        candidate_dpa_submitted: false,
        candidate_dpa_approved: false,
        dpa_accepted: true,
      },
    })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      public_id: 'doc_dpa_rejected',
      doc_type: 'data_processing_agreement',
      file_url: 'https://files.example.com/thoa-thuan.pdf',
      status: 'rejected',
      review_note: 'Thiếu chữ ký của người đại diện.',
      is_current: true,
    }])
    uploadEmployerDataProcessingAgreement.mockResolvedValue({
      id: 2,
      status: 'pending',
    })
    const user = userEvent.setup()
    const { container } = renderForm()

    expect((await screen.findAllByText('Từ chối')).length).toBeGreaterThan(0)
    expect(screen.getByText('Thiếu chữ ký của người đại diện.')).toBeVisible()
    expect(screen.queryByText('Hệ thống đang xử lý')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa văn bản' }))
    const replacement = new File(['replacement'], 'thoa-thuan-moi.pdf', {
      type: 'application/pdf',
    })
    await user.upload(container.querySelector('input[type="file"]'), replacement)
    await user.click(screen.getByRole('checkbox', { name: /Tôi cam đoan văn bản này/i }))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(uploadEmployerDataProcessingAgreement).toHaveBeenCalledWith(
      replacement,
      expect.objectContaining({ replaceDocument: 'doc_dpa_rejected' }),
    ))
  })

  it('shows the admin guidance when changes are requested', async () => {
    getEmployerProfile.mockResolvedValue({
      onboarding: { candidate_dpa_submitted: true, candidate_dpa_approved: false },
    })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      public_id: 'doc_dpa_changes',
      doc_type: 'data_processing_agreement',
      status: 'changes_requested',
      review_note: 'Vui lòng bổ sung ngày ký.',
      is_current: true,
    }])

    renderForm()

    expect((await screen.findAllByText('Cần bổ sung')).length).toBeGreaterThan(0)
    expect(screen.getByText('Vui lòng bổ sung ngày ký.')).toBeVisible()
    expect(screen.queryByText('Hệ thống đang xử lý')).not.toBeInTheDocument()
  })
})
