import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerBusinessLicenseForm from './EmployerBusinessLicenseForm'

const {
  employerProfileKeys,
  getEmployerProfile,
  getEmployerCompanyDocuments,
  getEmployerCompanyDocumentContent,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
} = vi.hoisted(() => ({
  employerProfileKeys: {
    companyDocuments: ['employer', 'company', 'documents'],
  },
  getEmployerProfile: vi.fn(),
  getEmployerCompanyDocuments: vi.fn(),
  getEmployerCompanyDocumentContent: vi.fn(),
  uploadEmployerBusinessDocument: vi.fn(),
  uploadEmployerCompanyDocument: vi.fn(),
}))

vi.mock('@/entities/employer-profile', () => ({
  employerProfileKeys,
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
      'ProCV đã nhận được bộ giấy tờ xác thực của bạn và sẽ kiểm duyệt trong 24 giờ (trừ thứ bảy, chủ nhật, ngày nghỉ lễ, tết theo quy định).',
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
    const [authorizationInput, identityInput] = document.querySelectorAll('input[type="file"]')
    expect(authorizationInput).not.toHaveAttribute('multiple')
    expect(identityInput).toHaveAttribute('multiple')
  })

  it('rejects files larger than 5MB before submission', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    const user = userEvent.setup()
    const { container } = renderForm()

    await screen.findByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })
    await user.click(screen.getByText('Giấy ủy quyền và Giấy tờ định danh'))
    const authorizationInput = container.querySelector('input[type="file"]')
    const oversizedFile = new File(
      [new Uint8Array((5 * 1024 * 1024) + 1)],
      'uy-quyen-qua-lon.pdf',
      { type: 'application/pdf' },
    )
    await user.upload(authorizationInput, oversizedFile)

    expect(screen.queryByText('uy-quyen-qua-lon.pdf')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  })

  it('previews selected identity images before submission', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    const createObjectURL = vi.fn(() => 'blob:selected-identity')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const user = userEvent.setup()
    const { container } = renderForm()

    await screen.findByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })
    await user.click(screen.getByText('Giấy ủy quyền và Giấy tờ định danh'))
    const identityInput = container.querySelectorAll('input[type="file"]')[1]
    const identityImage = new File(['identity'], 'cccd-mat-truoc.png', { type: 'image/png' })
    await user.upload(identityInput, identityImage)

    expect(await screen.findByRole('img', { name: 'Xem trước cccd-mat-truoc.png' })).toHaveAttribute(
      'src',
      'blob:selected-identity',
    )
    await user.click(screen.getByRole('button', { name: 'Xem trước tệp cccd-mat-truoc.png' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('cccd-mat-truoc.png')
    expect(screen.getAllByRole('img', { name: 'Xem trước cccd-mat-truoc.png' })).toHaveLength(2)
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

    expect((await screen.findAllByText('Đang xử lý')).length).toBeGreaterThan(0)
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
    await user.click(screen.getByRole('button', { name: 'Thay tệp' }))
    const input = container.querySelector('input[type="file"]')
    const replacement = new File(['replacement'], 'gpkd-moi.pdf', { type: 'application/pdf' })
    await user.upload(input, replacement)
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(uploadEmployerBusinessDocument).toHaveBeenCalledWith(
      replacement,
      { replaceDocument: undefined },
    ))
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
        file_name: 'cccd-mat-truoc.png',
        file_url: '/employer/company/documents/3/content/',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        id: 4,
        doc_type: 'identity_document',
        file_name: 'cccd-mat-sau.png',
        file_url: '/employer/company/documents/4/content/',
        status: 'pending',
      })
    const user = userEvent.setup()
    const { container } = renderForm()

    await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy đăng ký doanh nghiệp' })
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa giấy tờ' }))
    await user.click(screen.getByText('Giấy ủy quyền và Giấy tờ định danh'))
    const [authorizationInput, identityInput] = container.querySelectorAll('input[type="file"]')
    const authorizationFile = new File(['authorization'], 'uy-quyen-moi.pdf', { type: 'application/pdf' })
    const identityFront = new File(['identity-front'], 'cccd-mat-truoc.png', { type: 'image/png' })
    const identityBack = new File(['identity-back'], 'cccd-mat-sau.png', { type: 'image/png' })
    await user.upload(authorizationInput, authorizationFile)
    await user.upload(identityInput, [identityFront, identityBack])
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(uploadEmployerCompanyDocument).toHaveBeenNthCalledWith(
      1,
      'authorization_letter',
      authorizationFile,
    ))
    expect(uploadEmployerCompanyDocument).toHaveBeenNthCalledWith(
      2,
      'identity_document',
      identityFront,
      { verificationMethod: 'authorization_and_id' },
    )
    expect(uploadEmployerCompanyDocument).toHaveBeenNthCalledWith(
      3,
      'identity_document',
      identityBack,
      { append: true },
    )
    expect(await screen.findByRole('button', { name: 'Xem tệp đã nộp: Giấy ủy quyền' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy tờ định danh 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy tờ định danh 2' })).toBeVisible()
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

    expect(await screen.findByText('Có file bị từ chối')).toBeVisible()
    expect(screen.getByText('Từ chối')).toBeVisible()
    expect(screen.getByText('Ảnh giấy tờ không rõ nét.')).toBeVisible()
  })

  it('replaces only the rejected identity file and keeps approved files', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: true } })
    getEmployerCompanyDocuments.mockResolvedValue([
      {
        id: 1,
        public_id: 'doc_auth',
        doc_type: 'authorization_letter',
        file_name: 'uy-quyen.pdf',
        status: 'approved',
      },
      {
        id: 2,
        public_id: 'doc_front',
        doc_type: 'identity_document',
        file_name: 'cccd-truoc.png',
        status: 'approved',
      },
      {
        id: 3,
        public_id: 'doc_back',
        doc_type: 'identity_document',
        file_name: 'cccd-sau.png',
        status: 'rejected',
        review_note: 'Mặt sau bị mờ.',
      },
    ])
    uploadEmployerCompanyDocument.mockResolvedValue({
      id: 4,
      public_id: 'doc_back_v2',
      doc_type: 'identity_document',
      file_name: 'cccd-sau-moi.png',
      status: 'pending',
    })
    const user = userEvent.setup()
    renderForm()

    expect(await screen.findByText('Có file bị từ chối')).toBeVisible()
    expect(screen.getByText('Mặt sau bị mờ.')).toBeVisible()
    expect(screen.getAllByText('Đã duyệt')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa giấy tờ' }))
    expect(screen.queryByRole('heading', {
      name: 'Tệp thay thế cho Giấy ủy quyền *',
    })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', {
      name: 'Tệp thay thế cho Giấy tờ định danh 1 *',
    })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Thay tệp' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Thêm ảnh giấy tờ định danh' })).toBeVisible()
    const replacementHeading = screen.getByRole('heading', {
      name: 'Tệp thay thế cho Giấy tờ định danh 2 *',
    })
    const replacementInput = replacementHeading.parentElement.querySelector('input[type="file"]')
    const replacement = new File(['clear-back'], 'cccd-sau-moi.png', { type: 'image/png' })
    await user.upload(replacementInput, replacement)
    expect(screen.getByText('Tệp mới: cccd-sau-moi.png')).toBeVisible()
    const saveButton = screen.getByRole('button', { name: 'Lưu' })
    expect(saveButton).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy ủy quyền' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem tệp đã nộp: Giấy tờ định danh 2' })).toBeVisible()
    fireEvent.click(saveButton)

    await waitFor(() => expect(uploadEmployerCompanyDocument).toHaveBeenCalledWith(
      'identity_document',
      replacement,
      {
        replaceDocument: 'doc_back',
        verificationMethod: 'authorization_and_id',
      },
    ))
  })
})
