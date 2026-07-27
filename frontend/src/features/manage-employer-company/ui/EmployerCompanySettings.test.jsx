import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerCompanySettings from './EmployerCompanySettings'

const api = vi.hoisted(() => ({
  employerProfileKeys: {
    company: ['employer', 'company'],
    companyDocuments: ['employer', 'company', 'documents'],
  },
  getEmployerProfile: vi.fn(),
  getEmployerIndustries: vi.fn(),
  getEmployerCompanyCatalogs: vi.fn(),
  getEmployerCompanyDocuments: vi.fn(),
  getEmployerCompanyList: vi.fn(),
  joinEmployerCompany: vi.fn(),
  createEmployerCompany: vi.fn(),
  createEmployerCompanyUpdateRequest: vi.fn(),
  deleteEmployerCompanyImage: vi.fn(),
  deleteEmployerCompanyLogo: vi.fn(),
  uploadEmployerCompanyDocument: vi.fn(),
  saveEmployerCompanyTradeNameWebsite: vi.fn(),
  uploadEmployerCompanyImage: vi.fn(),
  uploadEmployerCompanyLogo: vi.fn(),
  getEmployerCompanyUpdateRequests: vi.fn(),
}))

vi.mock('@/entities/employer-profile', () => api)

describe('EmployerCompanySettings', () => {
  beforeEach(() => {
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
        ], verification_status: 'unverified',
      }],
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([])
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

  it('hides company selection after the account has been linked', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true, phone_verified: false },
      company_role: 'member',
      company: {
        public_id: 'co_linked', company_name: 'Công ty đã liên kết', tax_code: '0101234567',
        verification_status: 'unverified', industries_detail: [], images: [],
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
    expect(await screen.findByRole('button', { name: /Tạo yêu cầu/ })).toBeEnabled()
    expect(screen.queryByRole('tab', { name: /Tìm kiếm thông tin công ty/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Tạo công ty mới/ })).not.toBeInTheDocument()
  })

  it('keeps an existing pending company update editable', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        verification_status: 'verified',
        industries_detail: [],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([
      {
        public_id: 'cur_pending',
        status: 'pending',
        changes: { website_url: 'https://example.com/abc' },
        revision: 2,
        created_at: '2026-07-25T10:00:00Z',
        updated_at: '2026-07-26T10:00:00Z',
      },
      {
        public_id: 'cur_rejected',
        status: 'rejected',
        review_note: 'Lý do từ chối của yêu cầu cũ.',
        created_at: '2026-07-24T10:00:00Z',
        updated_at: '2026-07-24T11:00:00Z',
      },
    ])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    const updateRequest = await screen.findByRole('region', { name: 'Yêu cầu cập nhật thông tin công ty' })

    expect(within(updateRequest).getByRole('button', { name: /Chỉnh sửa yêu cầu/ })).toBeEnabled()
    expect(within(updateRequest).getByText('Đang xử lý')).toBeInTheDocument()
    expect(screen.queryByText('Bị từ chối')).not.toBeInTheDocument()
    expect(screen.queryByText('Lý do từ chối của yêu cầu cũ.')).not.toBeInTheDocument()
  })

  it('shows gallery images uploaded in the previous pending revision', async () => {
    api.getEmployerProfile.mockResolvedValue({
      onboarding: { company_linked: true },
      company_role: 'owner',
      company: {
        public_id: 'co_linked',
        company_name: 'Công ty đã liên kết',
        tax_code: '0101234567',
        verification_status: 'verified',
        industries_detail: [],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_pending',
      status: 'pending',
      changes: {
        gallery_additions: ['employers/co_linked/gallerys/office.png'],
      },
      media_previews: {
        gallery_additions: ['http://localhost:8000/media/employers/co_linked/gallerys/office.png'],
      },
      documents: [],
      updated_at: '2026-07-27T00:00:00Z',
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
        verification_status: 'verified',
        industries_detail: [{ id: 1, name: 'IT - Phần mềm', is_primary: true }],
        images: [],
      },
    })
    api.getEmployerCompanyUpdateRequests.mockResolvedValue([{
      public_id: 'cur_pending',
      status: 'pending',
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
      updated_at: '2026-07-27T00:00:00Z',
    }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><EmployerCompanySettings /></MemoryRouter>
      </QueryClientProvider>,
    )

    const requestRegion = await screen.findByRole('region', { name: 'Yêu cầu cập nhật thông tin công ty' })
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
})
