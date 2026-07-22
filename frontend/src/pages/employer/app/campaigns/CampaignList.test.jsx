import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { changeCampaignStatus, getCampaigns, getCampaignSuggestions } = vi.hoisted(() => ({
  changeCampaignStatus: vi.fn(),
  getCampaigns: vi.fn(),
  getCampaignSuggestions: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  CAMPAIGN_SCOPE_OPTIONS: [
    { value: '', label: 'Tất cả chiến dịch' },
    { value: 'needs_review', label: 'Có CV ứng tuyển mới cần xem' },
  ],
  CAMPAIGN_STATUS_COLORS: { active: 'green' },
  CAMPAIGN_STATUS_LABELS: { active: 'Đang mở' },
  campaignKeys: { all: ['campaigns'], list: (params = {}) => ['campaigns', 'list', params] },
  changeCampaignStatus,
  createCampaign: vi.fn(),
  createCampaignFromNeed: vi.fn(),
  getCampaigns,
  getCampaignSuggestions,
}))

function renderPage(initialEntry = '/tuyendung/app/campaigns') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tuyendung/app/campaigns" element={<CampaignList />} />
          <Route path="/tuyendung/app/campaigns/:publicId" element={<p>Campaign detail</p>} />
          <Route path="/tuyendung/app/jobs/new" element={<p>New job page</p>} />
          <Route path="/tuyendung/app/jobs/:publicId" element={<p>Job detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignList', () => {
  beforeEach(() => {
    changeCampaignStatus.mockReset()
    getCampaigns.mockReset()
    getCampaignSuggestions.mockReset()
    getCampaigns.mockResolvedValue([])
    getCampaignSuggestions.mockResolvedValue([])
  })

  it('searches on Enter and sends the query to the API', async () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Tìm chiến dịch (Nhấn Enter để tìm kiếm)'), {
      target: { value: 'Frontend' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Tìm chiến dịch (Nhấn Enter để tìm kiếm)'), {
      key: 'Enter',
      code: 'Enter',
    })

    expect(await screen.findByDisplayValue('Frontend')).toBeInTheDocument()
    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ q: 'Frontend' }))
  })

  it('links the campaign name to its detail page and shows its single job', async () => {
    getCampaigns.mockResolvedValue([
      {
        public_id: 'camp_frontend',
        name: 'Tuyển Frontend',
        status: 'active',
        application_count: 3,
        accepted_count: 1,
        headcount_target: 2,
        campaign_job: {
          public_id: 'jb_frontend',
          title: 'Kỹ sư Frontend',
          status: 'active',
          deadline: '2026-08-31',
          application_count: 3,
          view_count: 18,
        },
      },
    ])
    renderPage()

    const jobLinks = await screen.findAllByRole('link', { name: 'Kỹ sư Frontend' })
    expect(screen.getAllByText('#camp_frontend').length).toBeGreaterThan(0)
    expect(jobLinks[0]).toHaveAttribute('href', '/tuyendung/app/jobs/jb_frontend')

    fireEvent.click(screen.getAllByRole('link', { name: 'Tuyển Frontend' })[0])
    expect(await screen.findByText('Campaign detail')).toBeInTheDocument()
  })
})
