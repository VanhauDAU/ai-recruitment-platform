import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerDashboardOverview from './EmployerDashboardOverview'
import { DashboardVerificationJourney } from './DashboardWelcomeSections'

const { getEmployerDashboard, readinessState, useSession } = vi.hoisted(() => ({
  getEmployerDashboard: vi.fn(),
  readinessState: {
    readiness: {
      jobWorkspaceReady: true,
      candidateDataAccess: true,
      blockers: [],
    },
    profileQuery: { refetch: vi.fn() },
    isChecking: false,
    isAccessError: false,
    canAccessCandidateData: true,
  },
  useSession: vi.fn(),
}))

vi.mock('@/entities/employer-dashboard', () => ({ getEmployerDashboard }))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness: () => readinessState,
}))

describe('EmployerDashboardOverview', () => {
  beforeEach(() => {
    readinessState.readiness.jobWorkspaceReady = true
    readinessState.readiness.candidateDataAccess = true
    readinessState.readiness.blockers = []
    readinessState.isChecking = false
    readinessState.isAccessError = false
    readinessState.canAccessCandidateData = true
  })
  it('shows five main verification steps and keeps the first-job action separate', () => {
    render(
      <MemoryRouter>
        <DashboardVerificationJourney
          displayName="Nguyễn An"
          hasPassword
          jobWorkspaceReady
          verification={{
            phone_verified: true,
            company_linked: true,
            business_doc_submitted: true,
            candidate_dpa_submitted: true,
            dpa_accepted: true,
          }}
        />
      </MemoryRouter>,
    )

    expect(within(screen.getByLabelText('Các bước xác thực')).getAllByRole('link')).toHaveLength(5)
    expect(screen.getByLabelText('Đăng tin tuyển dụng đầu tiên')).toHaveAttribute('href', '/tuyendung/app/jobs/new')
  })

  it('renders server-backed summary, progress and priority need', async () => {
    useSession.mockReturnValue({ user: { full_name: 'Nguyễn An', email: 'hr@example.com' } })
    getEmployerDashboard.mockResolvedValue({
      account: {
        recruiter_public_id: 'rec_1',
        company_name: 'Công ty Acme',
        company_size: '25-99',
        work_location_name: 'Hà Nội',
        verification: {
          email_verified: true,
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: false,
          candidate_dpa_submitted: false,
          dpa_accepted: false,
          representative_verified: false,
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
    expect(screen.getByRole('heading', { name: 'Xu hướng hồ sơ ứng tuyển' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trạng thái hồ sơ' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Biểu đồ đường cong hồ sơ ứng tuyển 7 ngày/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Biểu đồ pipeline gồm 12 hồ sơ' })).toBeInTheDocument()
    expect(screen.getByText('Xác thực số điện thoại', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Xác thực địa chỉ email')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hoàn thiện workspace tuyển dụng' })).toBeInTheDocument()
    expect(screen.getByText('Công ty Acme')).toBeInTheDocument()
    expect(screen.getByText('Kinh doanh phần mềm')).toBeInTheDocument()
    expect(screen.getByText('240')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xác thực số điện thoại/ })).toHaveAttribute('target', '_blank')
    expect(screen.getByLabelText('Đăng tin tuyển dụng đầu tiên')).toHaveAttribute('href', '/tuyendung/app/jobs/new')
    expect(screen.getAllByRole('link', { name: /Đăng tin mới/ })[0]).toHaveAttribute('href', '/tuyendung/app/jobs/new')
    expect(screen.getByRole('link', { name: /Quản lý hồ sơ/ })).toHaveAttribute('href', '/tuyendung/app/applications')
  })

  it('opens the recruiter-verification surface from an approved recruiter status', async () => {
    useSession.mockReturnValue({ user: { full_name: 'Nguyễn An' } })
    getEmployerDashboard.mockResolvedValue({
      account: {
        recruiter_public_id: 'rec_verified',
        company_name: 'Công ty Acme',
        recruiter_verification_status: 'approved',
        verification: { representative_verified: true },
      },
      summary: {},
      application_activity: [],
      recent_jobs: [],
      recent_applications: [],
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><EmployerDashboardOverview /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('link', { name: /Nhà tuyển dụng đã xác thực/ }))
      .toHaveAttribute('href', '/tuyendung/app/employer-verify')
  })

  it('shows a visible warning after recruiter verification is revoked', async () => {
    useSession.mockReturnValue({ user: { full_name: 'Nguyễn An' } })
    getEmployerDashboard.mockResolvedValue({
      account: {
        recruiter_public_id: 'rec_revoked',
        company_name: 'Công ty Acme',
        recruiter_verification_status: 'revoked',
        verification: { representative_verified: true },
      },
      summary: {},
      application_activity: [],
      recent_jobs: [],
      recent_applications: [],
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><EmployerDashboardOverview /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Xác thực nhà tuyển dụng đã bị thu hồi')).toBeVisible()
    expect(screen.getByText(/không có nghĩa xác thực tài khoản còn hiệu lực/)).toBeVisible()
  })

  it('keeps aggregates but never mounts cached recent candidate PII when access is denied', async () => {
    readinessState.readiness.candidateDataAccess = false
    readinessState.readiness.blockers = [{
      code: 'dpa_outdated',
      capabilities: ['candidate_data'],
      message: 'Chấp thuận DPA không còn là phiên bản hiện hành.',
      action: 'accept_current_dpa',
    }]
    readinessState.canAccessCandidateData = false
    useSession.mockReturnValue({ user: { full_name: 'Nguyễn An' } })
    getEmployerDashboard.mockResolvedValue({
      account: { verification: {} },
      summary: { applications_total: 12 },
      recent_jobs: [],
      recent_applications: [{
        public_id: 'application_1',
        candidate_name: 'Nguyễn Minh Anh',
        job_title: 'Frontend Engineer',
        status: 'submitted',
        applied_at: '2026-08-01T09:00:00Z',
      }],
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><EmployerDashboardOverview /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect((await screen.findAllByText('12')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ứng viên mới nhất' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Chấp thuận DPA không còn là phiên bản hiện hành.').length)
      .toBeGreaterThan(0)
  })
})
