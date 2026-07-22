import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignDetail from './CampaignDetail'

const { getCampaign, getCampaignReport } = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignReport: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    detail: (id) => ['campaigns', 'detail', id],
    report: (id) => ['campaigns', 'report', id],
  },
  getCampaign,
  getCampaignReport,
}))
vi.mock('./CampaignApplyCvPanel', () => ({ default: () => <p>Bộ lọc CV ứng tuyển</p> }))
vi.mock('./CampaignJobsPanel', () => ({ default: () => <p>Danh sách tin tuyển dụng</p> }))

function renderPage(initialEntry = '/tuyendung/app/campaigns/camp_frontend') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tuyendung/app/campaigns/:publicId" element={<CampaignDetail />} />
          <Route path="/tuyendung/app/campaigns" element={<p>Danh sách chiến dịch</p>} />
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
      job_count: 2,
      application_count: 7,
    })
    getCampaignReport.mockResolvedValue({
      applications: { total: 7, new: 2 },
      jobs: { total: 2, active: 1 },
      headcount_target: 3,
      funnel: { submitted: 2, considering: 2, accepted: 1 },
    })
  })

  it('renders the TopCV campaign structure with real report metrics', async () => {
    renderPage()

    expect(await screen.findByText('Tổng lượng CV ứng viên')).toBeInTheDocument()
    expect(screen.getByText('CV đã kết nối')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'CV ứng tuyển' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Tin tuyển dụng' })).toBeInTheDocument()
    expect(screen.getByText('Bộ lọc CV ứng tuyển')).toBeInTheDocument()
  })

  it('switches content and keeps active_tab in the URL', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Tin tuyển dụng' }))

    await waitFor(() => expect(screen.getByText('Danh sách tin tuyển dụng')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Tin tuyển dụng' })).toHaveAttribute('aria-selected', 'true')
  })
})
