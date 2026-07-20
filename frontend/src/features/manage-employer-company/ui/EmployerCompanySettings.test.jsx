import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerCompanySettings from './EmployerCompanySettings'

const api = vi.hoisted(() => ({
  getEmployerProfile: vi.fn(),
  getEmployerIndustries: vi.fn(),
  getEmployerCompanyCatalogs: vi.fn(),
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
})
