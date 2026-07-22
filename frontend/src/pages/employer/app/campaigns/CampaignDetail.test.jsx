import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignDetail from './CampaignDetail'

const {
  getCampaign,
  getCampaignReport,
  getEmployerJobs,
  getRecruiterApplications,
} = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignReport: vi.fn(),
  getEmployerJobs: vi.fn(),
  getRecruiterApplications: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  CAMPAIGN_STATUS_COLORS: { active: 'green' },
  CAMPAIGN_STATUS_LABELS: { active: 'Đang mở' },
  campaignKeys: {
    all: ['campaigns'],
    detail: (id) => ['campaigns', 'detail', id],
    report: (id) => ['campaigns', 'report', id],
  },
  changeCampaignStatus: vi.fn(),
  getCampaign,
  getCampaignReport,
  updateCampaign: vi.fn(),
}))
vi.mock('@/entities/job', () => ({
  getEmployerJobs,
  getJobCategories: vi.fn(),
  jobKeys: { employerList: (params) => ['jobs', 'employer-list', params] },
}))
vi.mock('@/entities/application', () => ({
  applicationKeys: { recruiterList: (params) => ['applications', 'recruiter-list', params] },
  getRecruiterApplications,
  RECRUITER_APPLICATION_STATUS_LABELS: { submitted: 'Tiếp nhận', accepted: 'Đã nhận offer' },
}))
vi.mock('@/features/manage-campaigns', () => ({ CampaignForm: () => <p>Campaign form</p> }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tuyendung/app/campaigns/camp_frontend']}>
        <Routes>
          <Route path="/tuyendung/app/campaigns/:publicId" element={<CampaignDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignDetail', () => {
  beforeEach(() => {
    getCampaign.mockResolvedValue({
      public_id: 'camp_frontend',
      name: 'Tuyển Frontend',
      status: 'active',
      headcount_target: 2,
    })
    getCampaignReport.mockResolvedValue({
      headcount_target: 2,
      accepted_count: 1,
      applications: { total: 3, new: 1 },
      jobs: { total: 1, active: 1, pending: 0, views: 12 },
      funnel: { submitted: 1, accepted: 1 },
      daily_applications: [{ date: '2026-07-22', count: 1 }],
    })
    getEmployerJobs.mockResolvedValue([])
    getRecruiterApplications.mockResolvedValue([])
  })

  it('uses real campaign metrics and loads operational tabs on demand', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Tuyển Frontend' })).toBeInTheDocument()
    expect(screen.getByText('3', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Tin tuyển dụng (1)' }))
    await waitFor(() => expect(getEmployerJobs).toHaveBeenCalledWith({ campaign: 'camp_frontend' }))

    fireEvent.click(screen.getByRole('tab', { name: 'CV ứng tuyển (3)' }))
    await waitFor(() => expect(getRecruiterApplications).toHaveBeenCalledWith({ campaign: 'camp_frontend' }))
  })
})
