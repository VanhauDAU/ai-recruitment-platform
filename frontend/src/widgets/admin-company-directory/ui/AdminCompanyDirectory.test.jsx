import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCompanyDirectory from './AdminCompanyDirectory'
import AdminCompanyDetail from './AdminCompanyDetail'

const {
  getAdminCompanies,
  getAdminCompany,
  getAdminCompanyRecruiters,
  getAdminCompanySummary,
  useSession,
} = vi.hoisted(() => ({
  getAdminCompanies: vi.fn(),
  getAdminCompany: vi.fn(),
  getAdminCompanyRecruiters: vi.fn(),
  getAdminCompanySummary: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('@/entities/admin-company', async (importOriginal) => ({
  ...await importOriginal(),
  getAdminCompanies,
  getAdminCompany,
  getAdminCompanyRecruiters,
  getAdminCompanySummary,
}))
vi.mock('@/entities/session', () => ({ useSession }))

const company = {
  public_id: 'co_alpha',
  company_name: 'Công ty Alpha',
  trade_name: 'Alpha',
  logo_url: '',
  business_type: 'enterprise',
  business_type_label: 'Doanh nghiệp',
  tax_code: '***4567',
  verification_status: 'pending',
  owners: [{
    public_id: 'rec_owner',
    user_public_id: 'usr_owner',
    full_name: 'Owner chính',
    email: 'owner@example.com',
  }],
  recruiter_count: 2,
  owner_count: 1,
  member_count: 1,
  pending_update_count: 1,
  recruiter_verification_summary: {
    none: 1,
    draft: 0,
    pending: 0,
    changes_requested: 0,
    approved: 1,
    rejected: 0,
  },
  website_url: 'https://alpha.example',
  email: '',
  phone: '***567',
  address: 'Hà Nội',
  company_size: '25-99',
  company_size_label: '25 - 99 nhân viên',
  description: '<p>Công ty <strong>công nghệ</strong></p><script>window.bad = true</script>',
  industries: [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe', is_primary: true }],
  created_by: {
    public_id: 'usr_owner',
    full_name: 'Owner chính',
    email: 'owner@example.com',
  },
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function renderWithApp(element, initialEntry) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/app/companies" element={element} />
          <Route
            path="/admin/app/companies/:publicId"
            element={<><AdminCompanyDetail publicId="co_alpha" /><LocationProbe /></>}
          />
          <Route
            path="/admin/app/recruiters/:publicId"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('admin company directory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSession.mockReturnValue({
      user: {
        role: 'admin',
        admin_access: { is_superuser: true, permissions: [], memberships: [] },
      },
    })
    getAdminCompanies.mockResolvedValue({ count: 1, results: [company] })
    getAdminCompany.mockResolvedValue(company)
    getAdminCompanyRecruiters.mockResolvedValue({ count: 0, results: [] })
    getAdminCompanySummary.mockResolvedValue({
      total: 1,
      verification: { pending: 1, verified: 0 },
      pending_update_requests: 1,
      companies_without_single_owner: 0,
    })
  })

  it('keeps company and recruiter verification status visually separate', async () => {
    renderWithApp(
      <AdminCompanyDirectory />,
      '/admin/app/companies?verification_status=pending',
    )

    expect(await screen.findByText('Công ty Alpha')).toBeInTheDocument()
    expect(screen.getAllByText('Chờ duyệt')).toHaveLength(2)
    expect(screen.getByText('Chưa có hồ sơ: 1')).toBeInTheDocument()
    expect(screen.getByText('Đã xác thực: 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Công ty Alpha chưa cập nhật logo')).toHaveTextContent('A')
    expect(screen.getByRole('columnheader', { name: 'Xác thực NTD' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Lọc owner' })).not.toBeInTheDocument()
    expect(getAdminCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ verification_status: 'pending' }),
      expect.any(Object),
    )
  })

  it('uses server summary instead of the current company page', async () => {
    getAdminCompanySummary.mockResolvedValue({
      total: 47,
      verification: { pending: 8, verified: 31 },
      pending_update_requests: 6,
      companies_without_single_owner: 2,
    })
    renderWithApp(<AdminCompanyDirectory />, '/admin/app/companies')

    expect(await screen.findByText('Công ty Alpha')).toBeInTheDocument()
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('47')
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('31')
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('8')
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('6')
  })

  it('opens the read-only company detail', async () => {
    const user = userEvent.setup()
    const { container } = renderWithApp(<AdminCompanyDirectory />, '/admin/app/companies')

    await user.click(await screen.findByRole('button', { name: /Công ty Alpha/ }))

    expect(await screen.findByText('Hồ sơ pháp lý')).toBeInTheDocument()
    expect(screen.getByText('Thông tin doanh nghiệp')).toBeInTheDocument()
    expect(screen.getByText('công nghệ')).toBeInTheDocument()
    expect(container.querySelector('.company-directory__rich-text script')).toBeNull()
    expect(screen.queryByText(/<p>|<strong>|<script>/)).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/app/companies/co_alpha')
  })

  it('debounces company search before requesting new results', async () => {
    const user = userEvent.setup()
    renderWithApp(<AdminCompanyDirectory />, '/admin/app/companies')

    await screen.findByText('Công ty Alpha')
    const initialCalls = getAdminCompanies.mock.calls.length
    await user.type(screen.getByRole('searchbox', { name: 'Tìm công ty' }), ' beta')

    expect(getAdminCompanies).toHaveBeenCalledTimes(initialCalls)
    await waitFor(
      () => expect(getAdminCompanies).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'beta' }),
        expect.any(Object),
      ),
      { timeout: 1200 },
    )
  })

  it('loads owner/member roster only after opening the recruiter tab', async () => {
    getAdminCompanyRecruiters.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'rec_owner',
        account: {
          public_id: 'usr_owner',
          full_name: 'Owner chính',
          email: 'owner@example.com',
          avatar_url: '',
          status: 'active',
          email_verified: true,
          is_deleted: false,
        },
        company_role: 'owner',
        company_role_label: 'Người tạo công ty',
        position_title: 'HR Manager',
        phone_verified: true,
        onboarding_completed: true,
        verification: { status: 'approved' },
        created_at: '2026-07-01T00:00:00Z',
      }],
    })
    renderWithApp(
      <AdminCompanyDetail publicId="co_alpha" />,
      '/admin/app/companies/co_alpha',
    )

    fireEvent.click(await screen.findByRole('tab', { name: /Nhà tuyển dụng/ }))

    expect(await screen.findByText('HR Manager')).toBeInTheDocument()
    expect(screen.getByLabelText('Ảnh đại diện Owner chính')).toHaveTextContent('OC')
    expect(screen.getByText('Đã xác thực')).toBeInTheDocument()
    await waitFor(() => expect(getAdminCompanyRecruiters).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /Chi tiết/ }))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/app/recruiters/usr_owner',
    )
  }, 15_000)
})
