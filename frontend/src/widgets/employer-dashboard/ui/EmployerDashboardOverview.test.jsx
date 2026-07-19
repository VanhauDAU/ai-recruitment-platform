import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmployerDashboardOverview from './EmployerDashboardOverview'

const { getEmployerDashboard, useSession } = vi.hoisted(() => ({
  getEmployerDashboard: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('@/entities/employer-dashboard', () => ({ getEmployerDashboard }))
vi.mock('@/entities/session', () => ({ useSession }))

describe('EmployerDashboardOverview', () => {
  it('renders server-backed summary, progress and priority need', async () => {
    useSession.mockReturnValue({ user: { full_name: 'Nguyễn An', email: 'hr@example.com' } })
    getEmployerDashboard.mockResolvedValue({
      account: {
        recruiter_public_id: 'rec_1',
        company_name: 'Công ty Acme',
        company_verification_status: 'unverified',
        company_size: '25-99',
        work_location_name: 'Hà Nội',
        verification: {
          email_verified: true,
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: false,
          candidate_dpa_submitted: false,
          dpa_accepted: false,
          first_job_posted: true,
        },
      },
      summary: {
        jobs_active: 2,
        applications_total: 12,
        applications_new: 4,
        applications_shortlisted: 3,
        applications_interviewed: 1,
        job_views: 240,
      },
      application_activity: Array.from({ length: 7 }, (_, index) => ({ date: `2026-07-${String(12 + index).padStart(2, '0')}`, count: index })),
      recruitment_need: {
        position_category_name: 'Kinh doanh phần mềm',
        position_level_label: 'Nhân viên',
        headcount: 3,
        target_date: '2026-08-30',
        is_continuous: false,
      },
      recent_jobs: [],
      recent_applications: [],
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EmployerDashboardOverview />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: /Xin chào, Nguyễn An/ })).toBeInTheDocument()
    expect(document.querySelector('img[src="/images/employer/topcv-v-brand.svg"]')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('heading', { name: 'Đọc dữ liệu, tuyển đúng người' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Khám phá ProCV dành cho nhà tuyển dụng/ })).toBeInTheDocument()
    expect(screen.getByText('Xác thực số điện thoại', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Xác thực địa chỉ email')).not.toBeInTheDocument()
    expect(screen.getByText('Đăng tin tuyển dụng đầu tiên', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Công ty Acme')).toBeInTheDocument()
    expect(screen.getByText('Kinh doanh phần mềm')).toBeInTheDocument()
    expect(screen.getByText('240')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xác thực số điện thoại/ })).toHaveAttribute('target', '_blank')
    expect(screen.getByLabelText('Đăng tin tuyển dụng đầu tiên (đang khóa)')).toBeInTheDocument()
  })
})
