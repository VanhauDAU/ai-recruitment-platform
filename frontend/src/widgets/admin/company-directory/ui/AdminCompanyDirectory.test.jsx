import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTableRow } from '@/test/antd-queries'
import AdminCompanyDirectory from './AdminCompanyDirectory'
import AdminCompanyDetail from './AdminCompanyDetail'

const {
  getAdminCompanies,
  getAdminCompany,
  getAdminCompanyRecruiters,
  getAdminCompanySummary,
  getAdminJobs,
} = vi.hoisted(() => ({
  getAdminCompanies: vi.fn(),
  getAdminCompany: vi.fn(),
  getAdminCompanyRecruiters: vi.fn(),
  getAdminCompanySummary: vi.fn(),
  getAdminJobs: vi.fn(),
}))

vi.mock('@/entities/company/admin-company', async (importOriginal) => ({
  ...await importOriginal(),
  getAdminCompanies,
  getAdminCompany,
  getAdminCompanyRecruiters,
  getAdminCompanySummary,
}))
vi.mock('@/entities/job/admin-job', async (importOriginal) => ({
  ...await importOriginal(),
  getAdminJobs,
}))

const company = {
  public_id: 'co_alpha',
  code: 'C305812',
  company_name: 'Công ty Alpha',
  trade_name: 'Alpha',
  logo_url: '',
  business_type: 'enterprise',
  business_type_label: 'Doanh nghiệp',
  tax_code: '***4567',
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
          <Route
            path="/admin/app/job-moderation/:publicId"
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
    getAdminCompanies.mockResolvedValue({ count: 1, results: [company] })
    getAdminCompany.mockResolvedValue(company)
    getAdminCompanyRecruiters.mockResolvedValue({ count: 0, results: [] })
    getAdminJobs.mockResolvedValue({ count: 0, results: [] })
    getAdminCompanySummary.mockResolvedValue({
      total: 1,
      pending_update_requests: 1,
      companies_without_single_owner: 0,
    })
  })

  it('shows recruiter verification without company verification controls', async () => {
    renderWithApp(
      <AdminCompanyDirectory />,
      '/admin/app/companies?verification_status=pending',
    )

    expect(await screen.findByText('Công ty Alpha')).toBeInTheDocument()
    expect(screen.getByText('Chưa có hồ sơ · 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sao chép mã C305812' })).toBeInTheDocument()
    expect(screen.getByText('Đã xác thực · 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Công ty Alpha chưa cập nhật logo')).toHaveTextContent('A')
    expect(screen.getByRole('button', { name: 'Nhà tuyển dụng' })).toBeInTheDocument()
    expect(screen.queryByText('Hồ sơ pháp nhân')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Lọc trạng thái công ty' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Lọc owner' })).not.toBeInTheDocument()
    expect(getAdminCompanies).toHaveBeenCalledWith(
      expect.not.objectContaining({ verification_status: expect.anything() }),
      expect.any(Object),
    )
  })

  it('uses server summary instead of the current company page', async () => {
    getAdminCompanySummary.mockResolvedValue({
      total: 47,
      pending_update_requests: 6,
      companies_without_single_owner: 2,
    })
    renderWithApp(<AdminCompanyDirectory />, '/admin/app/companies')

    expect(await screen.findByText('Công ty Alpha')).toBeInTheDocument()
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('47')
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('2')
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('6')
    expect(screen.getByLabelText('Tóm tắt công ty')).toHaveTextContent('Cần kiểm tra quản lý')
  })

  it('filters companies that need a manager check from the summary tile', async () => {
    const user = userEvent.setup()
    renderWithApp(<AdminCompanyDirectory />, '/admin/app/companies')

    await screen.findByText('Công ty Alpha')
    await user.click(within(screen.getByLabelText('Tóm tắt công ty')).getByRole('button', { name: /Cần kiểm tra quản lý/ }))

    await waitFor(() => expect(getAdminCompanies).toHaveBeenLastCalledWith(
      expect.objectContaining({ has_owner: 'not_single' }),
      expect.any(Object),
    ))
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
        initial_onboarding: {
          completed: true,
          missing_steps: [],
        },
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
    const row = getTableRow('rec_owner')
    expect(within(row).getByLabelText('Ảnh đại diện Owner chính')).toHaveTextContent('OC')
    expect(within(row).getByText('Đã xác thực')).toBeInTheDocument()
    expect(within(row.closest('.ant-table')).getByRole('columnheader', { name: 'Thiết lập ban đầu' })).toBeInTheDocument()
    expect(screen.getByText('Đã đủ hồ sơ, email và nhu cầu')).toBeInTheDocument()
    await waitFor(() => expect(getAdminCompanyRecruiters).toHaveBeenCalled())

    // Text, not role: a role query walks the computed style of every ancestor
    // up to <body> under antd's injected CSS (2.7s here in jsdom).
    fireEvent.click(within(row).getByText('Chi tiết').closest('button'))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/app/recruiters/usr_owner',
    )
  })

  it('keeps the verification tab scoped to recruiter cases', async () => {
    renderWithApp(
      <AdminCompanyDetail publicId="co_alpha" />,
      '/admin/app/companies/co_alpha?tab=verification',
    )

    expect(await screen.findByRole('tab', { name: 'Xác thực NTD' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Xác thực nhà tuyển dụng')).toBeInTheDocument()
    expect(screen.getByText('Đã xác thực')).toBeInTheDocument()
    expect(screen.queryByText('Trạng thái pháp lý công ty')).not.toBeInTheDocument()
    expect(screen.queryByText('Pháp nhân đã xác thực')).not.toBeInTheDocument()
  })

  it('loads company jobs on demand and keeps the company as the API scope', async () => {
    const user = userEvent.setup()
    getAdminJobs.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'job_alpha',
        title: 'Backend Engineer',
        employer_name: 'Owner chính',
        employer_email: 'owner@example.com',
        status: 'active',
        status_label: 'Đang tuyển',
        is_expired: false,
        policy_hold: '',
        moderation_hold: '',
        deadline: '2026-08-30',
        created_at: '2026-07-31T08:00:00Z',
        submitted_at: '2026-08-01T08:00:00Z',
        application_count: 4,
        view_count: 25,
        pending_report_count: 0,
        updated_at: '2026-08-02T08:00:00Z',
      }],
    })
    renderWithApp(
      <AdminCompanyDetail publicId="co_alpha" />,
      '/admin/app/companies/co_alpha',
    )

    expect(getAdminJobs).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('tab', { name: 'Tin tuyển dụng' }))

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    await waitFor(() => expect(getAdminJobs).toHaveBeenCalledWith(
      {
        company: 'co_alpha',
        page: 1,
        ordering: '-created_at',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(screen.getByRole('columnheader', { name: 'Nhà tuyển dụng' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tạo lúc' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )

    await user.click(screen.getByText('Backend Engineer'))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/app/job-moderation/job_alpha',
    )
  })
})
