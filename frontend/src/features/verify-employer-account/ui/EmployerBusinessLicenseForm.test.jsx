import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerBusinessLicenseForm from './EmployerBusinessLicenseForm'

const {
  getEmployerProfile,
  getEmployerCompanyDocuments,
  getEmployerCompanyDocumentContent,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
} = vi.hoisted(() => ({
  getEmployerProfile: vi.fn(),
  getEmployerCompanyDocuments: vi.fn(),
  getEmployerCompanyDocumentContent: vi.fn(),
  uploadEmployerBusinessDocument: vi.fn(),
  uploadEmployerCompanyDocument: vi.fn(),
}))

vi.mock('@/entities/employer-profile', () => ({
  getEmployerProfile,
  getEmployerCompanyDocuments,
  getEmployerCompanyDocumentContent,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
}))

vi.mock('@/entities/site-settings', () => ({ useSiteSettings: () => ({ siteName: 'ProCV' }) }))

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><EmployerBusinessLicenseForm /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerBusinessLicenseForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    getEmployerProfile.mockReset()
    getEmployerCompanyDocuments.mockReset()
    getEmployerCompanyDocumentContent.mockReset()
    uploadEmployerBusinessDocument.mockReset()
    uploadEmployerCompanyDocument.mockReset()
    getEmployerCompanyDocuments.mockResolvedValue([])
  })

  it('keeps saving disabled until company information is updated', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false } })

    renderForm()

    expect(await screen.findByRole('heading', { name: /Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác/ })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'cập nhật thông tin công ty' })).toHaveAttribute('href', '/tuyendung/app/account/settings/company?update=true')
  })

  it('uploads a business registration document after a company is linked', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    uploadEmployerBusinessDocument.mockResolvedValue({ id: 1, status: 'pending' })
    const user = userEvent.setup()
    const { container } = renderForm()

    await screen.findByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })
    const input = container.querySelector('input[type="file"]')
    const file = new File(['registration'], 'business.pdf', { type: 'application/pdf' })
    await user.upload(input, file)

    const saveButton = screen.getByRole('button', { name: 'Lưu' })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    await waitFor(() => expect(uploadEmployerBusinessDocument).toHaveBeenCalledWith(file))
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'ProCV đã nhận được Giấy đăng ký doanh nghiệp của bạn và sẽ kiểm duyệt trong 24 giờ (trừ thứ bảy, chủ nhật, ngày nghỉ lễ, tết theo quy định).',
    )
  })

  it('switches to the authorization and identity-document flow', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false } })
    const user = userEvent.setup()

    renderForm()
    await screen.findByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })
    await user.click(screen.getByText('Giấy ủy quyền và Giấy tờ định danh'))

    const radioGroup = screen.getByRole('radiogroup')
    const authorizationRadio = screen.getByRole('radio', { name: 'Giấy ủy quyền và Giấy tờ định danh' })
    const authorizationHeading = screen.getByRole('heading', { name: 'Giấy ủy quyền *' })

    expect(radioGroup).toHaveClass('!grid')
    expect(authorizationRadio.compareDocumentPosition(authorizationHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Giấy ủy quyền', { exact: true })).toBeVisible()
    expect(screen.getByText('Giấy tờ định danh (CCCD/ Hộ chiếu)', { exact: true })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Minh họa giấy ủy quyền' })).toHaveAttribute('src', '/images/employer/authorization-sample.jpg')
    expect(screen.getByRole('link', { name: /Tải mẫu giấy ủy quyền/ })).toHaveAttribute('href', expect.stringContaining('1_cQDRuVuibU7XP1YPcsjpSYB8jokcqyR'))
  })

  it('shows the saved document status and lets the recruiter edit it', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'business_registration',
      file_name: 'gpkd.pdf',
      file_url: '/employer/company/documents/1/content/',
      status: 'pending',
      review_note: '',
    }])
    const user = userEvent.setup()

    renderForm()

    expect(await screen.findByText('Chờ duyệt')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy đăng ký doanh nghiệp' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa giấy tờ' }))

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeVisible()
    expect(screen.getByRole('heading', { name: /Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác/ })).toBeVisible()
  })

  it('shows the replacement returned by the upload immediately after editing', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'business_registration',
      file_name: 'gpkd-cu.pdf',
      file_url: '/employer/company/documents/1/content/',
      status: 'approved',
    }])
    uploadEmployerBusinessDocument.mockResolvedValue({
      id: 1,
      doc_type: 'business_registration',
      file_name: 'gpkd-moi.pdf',
      file_url: '/employer/company/documents/1/content/',
      status: 'pending',
    })
    const user = userEvent.setup()
    const { container } = renderForm()

    expect(await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy đăng ký doanh nghiệp' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa giấy tờ' }))
    const input = container.querySelector('input[type="file"]')
    const replacement = new File(['replacement'], 'gpkd-moi.pdf', { type: 'application/pdf' })
    await user.upload(input, replacement)
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(uploadEmployerBusinessDocument).toHaveBeenCalledWith(replacement))
    expect(await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy đăng ký doanh nghiệp' })).toBeVisible()
  })

  it('replaces business-registration documents when switching to authorization and identity', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'business_registration',
      file_name: 'gpkd-cu.pdf',
      file_url: '/employer/company/documents/1/content/',
      status: 'approved',
    }])
    uploadEmployerCompanyDocument
      .mockResolvedValueOnce({
        id: 2,
        doc_type: 'authorization_letter',
        file_name: 'uy-quyen-moi.pdf',
        file_url: '/employer/company/documents/2/content/',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        id: 3,
        doc_type: 'identity_document',
        file_name: 'cccd-moi.pdf',
        file_url: '/employer/company/documents/3/content/',
        status: 'pending',
      })
    const user = userEvent.setup()
    const { container } = renderForm()

    await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy đăng ký doanh nghiệp' })
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa giấy tờ' }))
    await user.click(screen.getByText('Giấy ủy quyền và Giấy tờ định danh'))
    const [authorizationInput, identityInput] = container.querySelectorAll('input[type="file"]')
    const authorizationFile = new File(['authorization'], 'uy-quyen-moi.pdf', { type: 'application/pdf' })
    const identityFile = new File(['identity'], 'cccd-moi.pdf', { type: 'application/pdf' })
    await user.upload(authorizationInput, authorizationFile)
    await user.upload(identityInput, identityFile)
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(uploadEmployerCompanyDocument).toHaveBeenNthCalledWith(
      1,
      'authorization_letter',
      authorizationFile,
    ))
    expect(uploadEmployerCompanyDocument).toHaveBeenNthCalledWith(
      2,
      'identity_document',
      identityFile,
      { verificationMethod: 'authorization_and_id' },
    )
    expect(await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy ủy quyền' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy tờ định danh' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Xem tệp đã nộp: Giấy đăng ký doanh nghiệp' })).not.toBeInTheDocument()
  })

  it('retains each submitted authorization document and opens it in a new tab', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    getEmployerCompanyDocuments.mockResolvedValue([
      {
        id: 1,
        doc_type: 'authorization_letter',
        file_name: 'giay-uy-quyen.pdf',
        file_url: '/employer/company/documents/1/content/',
        status: 'pending',
      },
      {
        id: 2,
        doc_type: 'identity_document',
        file_name: 'cccd.jpg',
        file_url: '/employer/company/documents/2/content/',
        status: 'pending',
      },
    ])
    getEmployerCompanyDocumentContent.mockResolvedValue(new Blob(['document'], { type: 'application/pdf' }))
    const createObjectURL = vi.fn(() => 'blob:employer-document')
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

    const authorizationButton = await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy ủy quyền' })
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy tờ định danh' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Minh họa giấy ủy quyền' })).toHaveAttribute('src', '/images/employer/authorization-sample.jpg')

    await user.click(authorizationButton)

    await waitFor(() => expect(getEmployerCompanyDocumentContent).toHaveBeenCalledWith(expect.objectContaining({ id: 1 })))
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(previewWindow.location.replace).toHaveBeenCalledWith('blob:employer-document')
  })

  it('shows the rejection reason for a rejected document', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'business_registration',
      file_name: 'gpkd.pdf',
      status: 'rejected',
      review_note: 'Ảnh giấy tờ không rõ nét.',
    }])

    renderForm()

    expect(await screen.findByText('Từ chối')).toBeVisible()
    expect(screen.getByText('Ảnh giấy tờ không rõ nét.')).toBeVisible()
  })
})
