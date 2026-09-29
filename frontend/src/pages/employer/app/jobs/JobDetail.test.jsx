import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobDetail from './JobDetail'

const mocks = vi.hoisted(() => ({
  getEmployerJob: vi.fn(),
  getEmployerActiveServices: vi.fn(),
  getEmployerServiceHistory: vi.fn(),
  getEmployerServiceInventory: vi.fn(),
  getJobPostingContext: vi.fn(),
  getRecruiterApplications: vi.fn(),
  readinessState: {
    readiness: {
      jobWorkspaceReady: true,
      verificationApproved: true,
      candidateDataAccess: false,
      dpaStatus: 'outdated',
      blockers: [{
        code: 'dpa_outdated',
        capabilities: ['candidate_data'],
        message: 'Chấp thuận DPA không còn là phiên bản hiện hành.',
        action: 'accept_current_dpa',
      }],
    },
    profileQuery: { refetch: vi.fn() },
    isChecking: false,
    isAccessError: false,
    canAccessCandidateData: false,
  },
}))

vi.mock('@/entities/application', () => ({
  applicationKeys: {
    recruiterList: (params) => ['applications', 'recruiter-list', params],
  },
  getRecruiterApplications: mocks.getRecruiterApplications,
}))
vi.mock('@/entities/job', () => ({
  closeEmployerJob: vi.fn(),
  extendEmployerJob: vi.fn(),
  getEmployerJob: mocks.getEmployerJob,
  getJobPostingContext: mocks.getJobPostingContext,
  jobKeys: {
    employerDetail: (id) => ['jobs', 'employer-detail', id],
    postingContext: ['jobs', 'posting-context'],
  },
  reopenEmployerJob: vi.fn(),
}))
vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness: () => mocks.readinessState,
}))
vi.mock('@/entities/service-package', () => ({
  activateEmployerService: vi.fn(),
  createEmployerJobAlert: vi.fn(),
  getEmployerActiveServices: mocks.getEmployerActiveServices,
  getEmployerServiceHistory: mocks.getEmployerServiceHistory,
  getEmployerServiceInventory: mocks.getEmployerServiceInventory,
  previewEmployerJobAlert: vi.fn(),
  previewEmployerServiceActivation: vi.fn(),
  refreshEmployerJobService: vi.fn(),
}))
vi.mock('./JobApplicationsWorkspace', () => ({
  default: ({ applications }) => (
    <div>{applications.map((application) => (
      <p key={application.public_id}>{application.candidate_name}</p>
    ))}</div>
  ),
}))
vi.mock('./JobDetailHeader', () => ({ default: ({ job }) => <h1>{job.title}</h1> }))
vi.mock('./JobInformationPanel', () => ({ default: () => <p>Thông tin tin tuyển dụng</p> }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="job-detail-location">{location.pathname}{location.search}</output>
}

function renderPage(activeTab = 'apply_cv') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/tuyendung/app/jobs/job_1?active_tab=${activeTab}`]}>
        <Routes>
          <Route path="/tuyendung/app/jobs/:publicId" element={<><JobDetail /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

describe('JobDetail candidate-data boundary', () => {
  beforeEach(() => {
    mocks.readinessState.canAccessCandidateData = false
    mocks.readinessState.isChecking = false
    mocks.readinessState.isAccessError = false
    mocks.readinessState.readiness.candidateDataAccess = false
    mocks.getEmployerJob.mockReset().mockResolvedValue({
      public_id: 'job_1',
      title: 'Kỹ sư Frontend',
      status: 'active',
      application_count: 8,
      view_count: 20,
    })
    mocks.getJobPostingContext.mockReset().mockResolvedValue({
      default_deadline_days: 30,
      max_deadline_days: 90,
      max_public_lifetime_days: 90,
      services: {
        activation_enabled: false,
        refresh_enabled: false,
        alert_enabled: false,
        metrics_enabled: false,
      },
    })
    mocks.getEmployerActiveServices.mockReset().mockResolvedValue([])
    mocks.getEmployerServiceHistory.mockReset().mockResolvedValue({ count: 0, results: [] })
    mocks.getEmployerServiceInventory.mockReset().mockResolvedValue([])
    mocks.getRecruiterApplications.mockReset().mockResolvedValue([{
      public_id: 'application_1',
      candidate_name: 'Nguyễn Minh Anh',
      source: 'applied',
      status: 'submitted',
    }])
  })

  it.each([
    ['denied', false],
    ['readiness error', true],
  ])('keeps the direct URL and makes zero application calls when %s', async (_, accessError) => {
    mocks.readinessState.isAccessError = accessError
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Kỹ sư Frontend' })).toBeInTheDocument()
    expect(mocks.getRecruiterApplications).not.toHaveBeenCalled()
    expect(screen.getByTestId('job-detail-location')).toHaveTextContent(
      '/tuyendung/app/jobs/job_1?active_tab=apply_cv',
    )
    expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument()
    expect(accessError
      ? screen.getByText('Không thể kiểm tra quyền truy cập')
      : screen.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeInTheDocument()
  })

  it('removes previously rendered candidate PII when access changes from true to false', async () => {
    mocks.readinessState.canAccessCandidateData = true
    mocks.readinessState.readiness.candidateDataAccess = true
    const page = renderPage()

    expect(await screen.findByText('Nguyễn Minh Anh')).toBeInTheDocument()
    expect(mocks.getRecruiterApplications).toHaveBeenCalledTimes(1)

    mocks.readinessState.canAccessCandidateData = false
    mocks.readinessState.readiness.candidateDataAccess = false
    page.rerender(
      <QueryClientProvider client={page.queryClient}>
        <MemoryRouter initialEntries={['/tuyendung/app/jobs/job_1?active_tab=apply_cv']}>
          <Routes>
            <Route path="/tuyendung/app/jobs/:publicId" element={<><JobDetail /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument())
    expect(mocks.getRecruiterApplications).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeInTheDocument()
  })

  it('shows active paid-service attribution in the dedicated job tab', async () => {
    mocks.getJobPostingContext.mockResolvedValue({
      default_deadline_days: 30,
      max_deadline_days: 90,
      max_public_lifetime_days: 90,
      services: {
        activation_enabled: true,
        refresh_enabled: false,
        alert_enabled: false,
        metrics_enabled: true,
      },
    })
    mocks.getEmployerServiceHistory.mockResolvedValue({ count: 1, results: [{
      public_id: 'jsa_featured',
      package_name: 'Tin nổi bật 14 ngày',
      job_public_id: 'job_1',
      job_title: 'Kỹ sư Frontend',
      job_status: 'active',
      status: 'active',
      starts_at: '2026-08-13T00:00:00Z',
      ends_at: '2026-08-27T00:00:00Z',
      items: [{ capability: 'sponsored_placement', name: 'Vị trí tài trợ', quantity: 1, remaining_quantity: 1 }],
      metrics: { available: true, impressions: 420, views: 35, saves: 8, applies: 3 },
    }] })

    renderPage('services')

    expect(await screen.findByText('Tin nổi bật 14 ngày')).toBeVisible()
    fireEvent.click(screen.getByText('Chi tiết', { exact: true }).closest('button'))
    expect(screen.getByText('420')).toBeVisible()
    expect(screen.getByText(/không phải mức tăng thuần/i)).toBeVisible()
    expect(mocks.getEmployerServiceHistory).toHaveBeenCalledWith({
      job_public_id: 'job_1',
      ordering: '-starts_at',
      page_size: 100,
    })
  })
})
