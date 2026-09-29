import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerCompanySettings from './EmployerCompanySettings'

const api = vi.hoisted(() => ({
  employerProfileKeys: {
    company: ['employer', 'company'],
    companyDocuments: ['employer', 'company', 'documents'],
    companyUpdateRequests: ['employer', 'company', 'update-requests'],
    companyUpdateRequestList: (scope) => ['employer', 'company', 'update-requests', { scope }],
  },
  getEmployerProfile: vi.fn(),
  getEmployerIndustries: vi.fn(),
  getEmployerCompanyCatalogs: vi.fn(),
  getEmployerCompanyDocuments: vi.fn(),
  getEmployerCompanyList: vi.fn(),
  joinEmployerCompany: vi.fn(),
  createEmployerCompany: vi.fn(),
  createEmployerCompanyUpdateRequest: vi.fn(),
  changeEmployerCompanyUpdateRequestLifecycle: vi.fn(),
  deleteEmployerCompanyImage: vi.fn(),
  deleteEmployerCompanyLogo: vi.fn(),
  uploadEmployerCompanyDocument: vi.fn(),
  saveEmployerCompanyTradeNameWebsite: vi.fn(),
  uploadEmployerCompanyImage: vi.fn(),
  uploadEmployerCompanyLogo: vi.fn(),
  getEmployerCompanyUpdateRequests: vi.fn(),
  prepareEmployerUpload: vi.fn(),
}))

vi.mock('@/entities/employer-profile', () => api)
vi.mock('@/shared/ui/RichTextEditor', () => ({
  default: ({ disabled, id, maxLength, onChange, placeholder, value = '' }) => (
    <textarea
      id={id}
      disabled={disabled}
      maxLength={maxLength}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

describe('EmployerCompanySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false, phone_verified: true } })
    api.getEmployerIndustries.mockResolvedValue([{ id: 1, name: 'IT - Phần mềm' }])
    api.getEmployerCompanyCatalogs.mockResolvedValue({
      business_types: [{ value: 'enterprise', label: 'Doanh nghiệp' }],
      company_sizes: [], markets: [], target_customers: [],
    })
    api.getEmployerCompanyDocuments.mockResolvedValue([])
    api.getEmployerCompanyList.mockResolvedValue({
      count: 1, next: null, previous: null,
      results: [{
        public_id: 'co_1', company_name: 'Công ty mới nhất', tax_code: '0101234567',
        address: 'Hà Nội', company_size: '25-99', industries_detail: [
          { id: 1, name: 'Công nghệ thông tin' },
          { id: 2, name: 'Phần mềm doanh nghiệp' },
        ],
      }],
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([])
    api.changeEmployerCompanyUpdateRequestLifecycle.mockResolvedValue({ status: 'withdrawn' })
    api.prepareEmployerUpload.mockImplementation(async (file) => ({
      public_id: `ups_${file.name}`,
    }))
  })

  it('shows the two option cards and loads recent companies without a search action', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('tab', { name: /Tìm kiếm thông tin công ty/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Tạo công ty mới/ })).toBeInTheDocument()
    expect(await screen.findByText('Công ty mới nhất')).toBeInTheDocument()
    expect(screen.getByTitle('Công nghệ thông tin · Phần mềm doanh nghiệp')).toBeInTheDocument()
    expect(api.getEmployerCompanyList).toHaveBeenCalledWith({ query: '', page: 1 })
  })

  it('shows and allows selecting every company returned by the catalog', async () => {
    api.getEmployerCompanyList.mockResolvedValue({
      count: 4,
      next: null,
      previous: null,
      results: [
        { public_id: 'co_alpha', company_name: 'Công ty Alpha' },
        { public_id: 'co_beta', company_name: 'Công ty Beta' },
        { public_id: 'co_gamma', company_name: 'Công ty Gamma' },
        { public_id: 'co_delta', company_name: 'Công ty Delta' },
      ],
    })
    api.joinEmployerCompany.mockReturnValue(new Promise(() => {}))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    for (const name of [
      'Công ty Alpha',
      'Công ty Beta',
      'Công ty Gamma',
      'Công ty Delta',
    ]) {
      const card = (await screen.findByRole('heading', { name })).closest('article')
      expect(within(card).getByRole('button', { name: 'Chọn' })).toBeEnabled()
    }
    const deltaCard = screen.getByRole('heading', { name: 'Công ty Delta' }).closest('article')
    fireEvent.click(within(deltaCard).getByRole('button', { name: 'Chọn' }))
    await waitFor(() => expect(api.joinEmployerCompany).toHaveBeenCalled())
    expect(api.joinEmployerCompany.mock.calls[0][0]).toEqual({ company: 'co_delta' })
  })

  it('allows selecting or creating a company without phone verification', async () => {
    api.getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false, phone_verified: false } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Chọn' })).toBeEnabled()
    expect(screen.queryByText(/Cần xác thực số điện thoại trước khi lưu/)).not.toBeInTheDocument()
    expect(screen.getByText('Lưu ý!')).toBeInTheDocument()
  })

  it('wires numeric tax-code and 500-character description rules into the create form', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('tab', { name: /Tạo công ty mới/ }))
    const taxCode = screen.getByRole('textbox', { name: /Mã số thuế/ })
    const description = screen.getByRole('textbox', { name: /Mô tả công ty/ })
    const submit = screen.getByRole('button', { name: 'Lưu và liên kết công ty' })

    fireEvent.change(taxCode, { target: { value: '01012ABC67' } })
    fireEvent.change(description, { target: { value: 'a'.repeat(499) } })
    fireEvent.click(submit)

    expect(await screen.findByText('Mã số thuế chỉ được gồm chữ số.')).toBeInTheDocument()
    expect(await screen.findByText(/Mô tả công ty phải có ít nhất 500 ký tự/)).toBeInTheDocument()
    expect(api.createEmployerCompany).not.toHaveBeenCalled()

    fireEvent.change(taxCode, { target: { value: '0101234567890' } })
    fireEvent.change(description, { target: { value: 'a'.repeat(500) } })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(screen.queryByText('Mã số thuế chỉ được gồm chữ số.')).not.toBeInTheDocument()
      expect(screen.queryByText(/Mô tả công ty phải có ít nhất 500 ký tự/)).not.toBeInTheDocument()
    })
  })

  it('hides company selection after the account has been linked', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true, phone_verified: false },
      company_role: 'member',
      company: {
        public_id: 'co_linked', company_name: 'Công ty đã liên kết', tax_code: '0101234567',
        industries_detail: [], images: [],
      },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Công ty đã liên kết')).toBeInTheDocument()
    expect(screen.getByText(/tài khoản không thể chuyển sang công ty khác/)).toBeInTheDocument()
    const mineRequest = await screen.findByRole('region', { name: 'Yêu cầu của tôi' })
    expect(within(mineRequest).getByRole('button', { name: /Tạo yêu cầu/ })).toBeEnabled()
    expect(within(mineRequest).queryByText(/Ngày gửi gần nhất/)).not.toBeInTheDocument()
    expect(api.getEmployerCompanyUpdateRequests).toHaveBeenCalledWith({ scope: 'mine' })
    expect(api.getEmployerCompanyUpdateRequests).not.toHaveBeenCalledWith({ scope: 'company' })
    expect(screen.queryByRole('tab', { name: /Tìm kiếm thông tin công ty/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Tạo công ty mới/ })).not.toBeInTheDocument()
  })

  it('keeps another member request and company history out of the employer page', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'member',
      company: {
        public_id: 'co_linked', company_name: 'Công ty đã liên kết', tax_code: '0101234567',
        industries_detail: [], images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    const createRequest = await screen.findByRole('button', { name: /Tạo yêu cầu/ })
    const mineRequest = screen.getByRole('region', { name: 'Yêu cầu của tôi' })
    expect(createRequest).toBeEnabled()
    expect(within(mineRequest).queryByText(/Ngày gửi gần nhất/)).not.toBeInTheDocument()
    expect(within(mineRequest).queryByText('Đang xử lý')).not.toBeInTheDocument()

    expect(screen.queryByRole('region', { name: 'Lịch sử yêu cầu chỉnh sửa công ty' }))
      .not.toBeInTheDocument()
    expect(screen.queryByText('Lịch sử yêu cầu của công ty')).not.toBeInTheDocument()
    expect(api.getEmployerCompanyUpdateRequests).toHaveBeenCalledTimes(1)
    expect(api.getEmployerCompanyUpdateRequests).toHaveBeenCalledWith({ scope: 'mine' })
  })

  it('blocks an empty update request and provides a back action', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        business_type: 'enterprise',
        company_name: 'Công ty đã liên kết',
        trade_name: 'Công ty đã liên kết',
        trade_name_same_as_registered: true,
        tax_code: '0101234567',
        has_no_logo: true,
        has_no_website: true,
        website_url: '',
        email: 'hr@example.com',
        phone: '0912345678',
        address: 'Hà Nội',
        company_size: '25-99',
        description: '<p>Giới thiệu công ty</p>',
        employee_benefits: '',
        markets: [],
        target_customers: [],
        industries_detail: [{ id: 1, name: 'IT - Phần mềm', is_primary: true }],
        images: [],
      },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Tạo yêu cầu/ }))

    const submit = screen.getByRole('button', { name: /Gửi yêu cầu cập nhật/ })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute(
      'title',
      'Hãy thay đổi ít nhất một thông tin trước khi gửi.',
    )
    expect(screen.getByRole('button', { name: 'Quay lại thông tin công ty' })).toBeEnabled()
    fireEvent.submit(submit.closest('form'))
    expect(api.createEmployerCompanyUpdateRequest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại thông tin công ty' }))
    expect(await screen.findByText('Công ty đã liên kết')).toBeInTheDocument()
  })

  it('submits an unrelated change without requiring or adding a blank legacy trade name', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_legacy_trade_name',
        business_type: 'enterprise',
        company_name: 'Công ty Legacy',
        trade_name: '',
        trade_name_same_as_registered: false,
        tax_code: '0101234567',
        has_no_logo: true,
        website_url: 'https://legacy.example.com',
        has_no_website: false,
        email: 'hr@legacy.example.com',
        phone: '0912345678',
        address: 'Hà Nội',
        company_size: '25-99',
        description: '<p>Giới thiệu công ty Legacy</p>',
        employee_benefits: '',
        markets: [],
        target_customers: [],
        industries_detail: [{ id: 1, name: 'IT - Phần mềm', is_primary: true }],
        images: [],
      },
    })
    api.createEmployerCompanyUpdateRequest.mockResolvedValue({ public_id: 'cur_address' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Tạo yêu cầu/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /^Địa chỉ liên hệ\/văn phòng/ }), {
      target: { value: 'TP.HCM' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu cập nhật/ }))

    await waitFor(() => expect(api.createEmployerCompanyUpdateRequest).toHaveBeenCalledWith({
      changes: { address: 'TP.HCM' },
      reason: '',
      proof_type: '',
    }))
    expect(screen.queryByText('Nhập tên thương mại.')).not.toBeInTheDocument()
  })

  it('shows a retry state and keeps write actions locked when request data fails', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'member',
      company: {
        public_id: 'co_linked', company_name: 'Công ty đã liên kết', tax_code: '0101234567',
        industries_detail: [], images: [],
      },
    })
    let mineFails = true
    api.getEmployerCompanyUpdateRequests.mockImplementation(({ scope }) => {
      if (scope === 'mine' && mineFails) return Promise.reject(new Error('request failed'))
      return Promise.resolve([])
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Không tải được dữ liệu yêu cầu chỉnh sửa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo yêu cầu' })).not.toBeInTheDocument()

    mineFails = false
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByRole('button', { name: /Tạo yêu cầu/ })).toBeEnabled()
    expect(screen.queryByText('Không tải được dữ liệu yêu cầu chỉnh sửa')).not.toBeInTheDocument()
  })

  it('omits a missing or invalid submitted date without falling back to update timestamps', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'member',
      company: {
        public_id: 'co_linked', company_name: 'Công ty đã liên kết', tax_code: '0101234567',
        industries_detail: [], images: [],
      },
    })
    const request = {
      public_id: 'cur_invalid_date',
      status: 'pending',
      submitted_at: 'not-a-date',
      updated_at: '2035-08-10T08:30:00Z',
      requested_by_summary: { public_id: 'usr_member', display_name: 'Nguyễn Thành viên' },
      changes: { website_url: 'https://example.com' },
    }
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([request])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByRole('button', { name: /Chỉnh sửa yêu cầu/ })
    const mineRequest = screen.getByRole('region', { name: 'Yêu cầu của tôi' })
    expect(within(mineRequest).queryByText(/Ngày gửi gần nhất/)).not.toBeInTheDocument()
    expect(within(mineRequest).queryByText(/2035/)).not.toBeInTheDocument()
  })

  it('disables an open form when a background request refresh fails', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked', company_name: 'Công ty đã liên kết', tax_code: '0101234567',
        industries_detail: [], images: [],
      },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Tạo yêu cầu/ }))
    const submit = await screen.findByRole('button', { name: /Gửi yêu cầu cập nhật/ })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: /^Địa chỉ liên hệ\/văn phòng/ }), {
      target: { value: 'TP.HCM' },
    })
    expect(submit).toBeEnabled()

    api.getEmployerCompanyUpdateRequests.mockRejectedValue(new Error('background refresh failed'))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: api.employerProfileKeys.companyUpdateRequests })
    })

    await waitFor(() => expect(submit).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Chọn logo' })).toBeDisabled()
    expect(screen.getByText('Không tải được dữ liệu yêu cầu chỉnh sửa')).toBeInTheDocument()
  })

  it('keeps an existing submitted company update editable', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        industries_detail: [],
        images: [],
      },
    })
    const requests = [
      {
        public_id: 'cur_submitted',
        status: 'submitted',
        changes: { website_url: 'https://example.com/abc' },
        revision: 2,
        submitted_at: '2026-07-25T10:00:00Z',
        created_at: '2026-07-25T10:00:00Z',
        updated_at: '2035-07-26T10:00:00Z',
        requested_by_summary: { public_id: 'usr_owner', display_name: 'Nguyễn Chủ sở hữu' },
      },
      {
        public_id: 'cur_rejected',
        status: 'rejected',
        review_note: 'Lý do từ chối của yêu cầu cũ.',
        submitted_at: '2026-07-24T10:00:00Z',
        created_at: '2026-07-24T10:00:00Z',
        updated_at: '2026-07-24T11:00:00Z',
        requested_by_summary: { public_id: 'usr_owner', display_name: 'Nguyễn Chủ sở hữu' },
      },
    ]
    api.getEmployerCompanyUpdateRequests.mockImplementation(({ scope }) => (
      Promise.resolve(scope === 'mine' ? [requests[0]] : requests)
    ))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByRole('button', { name: /Chỉnh sửa yêu cầu/ })
    const updateRequest = screen.getByRole('region', { name: 'Yêu cầu của tôi' })

    expect(within(updateRequest).getByRole('button', { name: /Chỉnh sửa yêu cầu/ })).toBeEnabled()
    expect(within(updateRequest).getByText('Đã gửi')).toBeInTheDocument()
    expect(within(updateRequest).getByText(/2026/)).toBeInTheDocument()
    expect(within(updateRequest).queryByText(/2035/)).not.toBeInTheDocument()
    expect(within(updateRequest).queryByText('Bị từ chối')).not.toBeInTheDocument()
    expect(screen.queryByText('Lý do từ chối của yêu cầu cũ.')).not.toBeInTheDocument()
  })

  it('shows the review reason when my latest company update request was rejected', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        industries_detail: [],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_rejected',
      status: 'rejected',
      rejection_reason: 'Không thể đối chiếu địa chỉ với giấy phép đã gửi.',
      submitted_at: '2026-08-10T00:00:00Z',
    }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    const rejectionReason = await screen.findByText(
      'Lý do từ chối: Không thể đối chiếu địa chỉ với giấy phép đã gửi.',
    )
    const requestRegion = screen.getByRole('region', { name: 'Yêu cầu của tôi' })
    expect(within(requestRegion).getByText(rejectionReason.textContent)).toBeInTheDocument()
    expect(within(requestRegion).getByRole('button', { name: /Tạo yêu cầu/ })).toBeEnabled()
  })

  it('confirms withdrawing an update request in the shared accessible dialog', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        industries_detail: [],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_submitted',
      status: 'submitted',
      lock_version: 4,
      changes: { address: 'Đà Nẵng' },
      allowed_actions: ['withdraw'],
      submitted_at: '2026-08-10T00:00:00Z',
    }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Rút yêu cầu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rút yêu cầu cập nhật' })
    expect(within(dialog).getByText(/Yêu cầu sẽ dừng xử lý/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rút yêu cầu' }))
    await waitFor(() => {
      expect(api.changeEmployerCompanyUpdateRequestLifecycle).toHaveBeenCalledWith(
        'cur_submitted',
        'withdraw',
        { lock_version: 4 },
      )
    })
  })

  it('shows gallery images uploaded in the previous pending revision', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        industries_detail: [],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_submitted',
      status: 'submitted',
      changes: {
        gallery_additions: ['employers/co_linked/gallerys/office.png'],
      },
      media_previews: {
        gallery_additions: ['http://localhost:8000/media/employers/co_linked/gallerys/office.png'],
      },
      documents: [],
      submitted_at: '2026-07-27T00:00:00Z',
      requested_by_summary: { public_id: 'usr_owner', display_name: 'Nguyễn Chủ sở hữu' },
    }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Chỉnh sửa yêu cầu/ }))

    const pendingImage = await screen.findByRole('img', {
      name: 'Ảnh công ty đang chờ duyệt 1',
    })
    expect(pendingImage).toHaveAttribute(
      'src',
      'http://localhost:8000/media/employers/co_linked/gallerys/office.png',
    )
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
  })

  it('shows document revision reasons and opens the replacement upload', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        trade_name: 'Công ty đã liên kết',
        trade_name_same_as_registered: true,
        tax_code: '0101234567',
        industries_detail: [{ id: 1, name: 'IT - Phần mềm', is_primary: true }],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_changes_requested',
      status: 'changes_requested',
      proof_type: 'business_registration',
      reason: 'Đổi tên theo đăng ký mới',
      changes: { company_name: 'Công ty tên mới' },
      documents: [{
        id: 12,
        public_id: 'doc_business',
        doc_type: 'business_registration',
        doc_type_label: 'Giấy đăng ký doanh nghiệp',
        is_current: true,
        status: 'changes_requested',
        status_label: 'Cần bổ sung',
        review_note: 'Ảnh bị mờ, vui lòng tải bản rõ đủ bốn góc.',
      }],
      submitted_at: '2026-07-27T00:00:00Z',
      requested_by_summary: { public_id: 'usr_owner', display_name: 'Nguyễn Chủ sở hữu' },
    }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByRole('button', { name: 'Bổ sung giấy tờ' })
    const requestRegion = screen.getByRole('region', { name: 'Yêu cầu của tôi' })
    expect(within(requestRegion).getByText('Cần bổ sung giấy tờ')).toBeInTheDocument()
    expect(screen.getByText('Ảnh bị mờ, vui lòng tải bản rõ đủ bốn góc.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bổ sung giấy tờ ngay' }))
    expect(await screen.findByText('Yêu cầu này cần bổ sung giấy tờ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chọn giấy tờ thay thế' }))

    const dialog = screen.getByRole('dialog', { name: 'Xác nhận thay đổi thông tin pháp lý' })
    expect(within(dialog).getByText('Giấy tờ trước chưa đạt yêu cầu')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Chọn giấy đăng ký doanh nghiệp' })).toBeInTheDocument()
    expect(within(dialog).getByText('Cần chọn tệp mới theo yêu cầu của quản trị viên.')).toBeInTheDocument()
  })

  it('locks editing while the exact request is in review', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        industries_detail: [],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_in_review',
      status: 'in_review',
      changes: { address: 'Đà Nẵng' },
      submitted_at: '2026-08-10T00:00:00Z',
      allowed_actions: [],
    }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    const requestRegion = await screen.findByRole('region', { name: 'Yêu cầu của tôi' })
    expect(await within(requestRegion).findAllByText('Đang thẩm định')).toHaveLength(2)
    expect(within(requestRegion).getByRole('button', { name: 'Đang thẩm định' }))
      .toBeDisabled()
    expect(within(requestRegion).queryByRole('button', { name: /Rút yêu cầu/ }))
      .not.toBeInTheDocument()
  })
})
