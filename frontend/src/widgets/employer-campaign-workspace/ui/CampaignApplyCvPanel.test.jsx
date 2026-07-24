import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignApplyCvPanel from './CampaignApplyCvPanel'

const mocks = vi.hoisted(() => ({
  exportRecruiterApplications: vi.fn(),
  getCampaignReport: vi.fn(),
  getEmployerJobs: vi.fn(),
  getRecruiterApplicationPage: vi.fn(),
}))

vi.mock('@/entities/application', () => ({
  applicationKeys: { recruiterList: (params) => ['applications', 'recruiter-list', params] },
  exportRecruiterApplications: mocks.exportRecruiterApplications,
  getRecruiterApplicationPage: mocks.getRecruiterApplicationPage,
  RECRUITER_APPLICATION_STATUSES: [['submitted', 'Tiếp nhận'], ['accepted', 'Đã nhận offer']],
  RECRUITER_APPLICATION_STATUS_LABELS: { submitted: 'Tiếp nhận', accepted: 'Đã nhận offer' },
}))
vi.mock('@/entities/campaign', () => ({
  campaignKeys: { report: (id) => ['campaigns', 'report', id] },
  getCampaignReport: mocks.getCampaignReport,
}))
vi.mock('@/entities/job', () => ({
  getEmployerJobs: mocks.getEmployerJobs,
  jobKeys: { employerList: (params) => ['jobs', 'employer-list', params] },
}))

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CampaignApplyCvPanel publicId="camp_1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignApplyCvPanel', () => {
  beforeEach(() => {
    mocks.getRecruiterApplicationPage.mockReset().mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'app_1',
        candidate_name: 'Nguyễn An',
        candidate_email: 'an@example.com',
        job_title: 'Kỹ sư Frontend',
        submitted_cv_title: 'CV Frontend',
        applied_at: '2026-07-22T08:00:00+07:00',
        status: 'accepted',
      }],
    })
    mocks.getCampaignReport.mockResolvedValue({ unviewed_count: 0, unanswered_count: 0 })
    mocks.getEmployerJobs.mockResolvedValue([])
  })

  it('shows status as read-only and removes the external processing action', async () => {
    renderPanel()

    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('Đã nhận offer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /chi tiết/i })).toHaveAttribute(
      'href',
      '/tuyendung/app/applications?campaign=camp_1&application=app_1',
    )
    expect(screen.queryByLabelText('Cập nhật trạng thái hồ sơ')).not.toBeInTheDocument()
  })
})
