import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { changeCampaignStatus, getCampaigns, updateCampaign } = vi.hoisted(() => ({
  changeCampaignStatus: vi.fn(),
  getCampaigns: vi.fn(),
  updateCampaign: vi.fn(),
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
  getCampaigns,
  updateCampaign,
}))

function CampaignDetailRoute() {
  const location = useLocation()
  return <p data-testid="campaign-detail-location">{location.search}</p>
}

function renderPage(initialEntry = '/tuyendung/app/campaigns') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tuyendung/app/campaigns" element={<CampaignList />} />
          <Route path="/tuyendung/app/campaigns/:publicId" element={<CampaignDetailRoute />} />
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
    getCampaigns.mockResolvedValue([])
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

  it('links the campaign name to its detail page and shows aggregate campaign counts', async () => {
    getCampaigns.mockResolvedValue([
      {
        public_id: 'camp_frontend',
        name: 'Tuyển Frontend',
        status: 'active',
        application_count: 3,
        job_count: 2,
        active_job_count: 1,
        pending_job_count: 1,
        unviewed_application_count: 1,
        updated_at: '2026-07-22T09:00:00Z',
      },
    ])
    renderPage()

    await screen.findAllByRole('link', { name: 'Tuyển Frontend' })
    expect(screen.getAllByText('#camp_frontend').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Đang tuyển 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chờ duyệt 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Đăng thêm tin/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('link', { name: 'Tuyển Frontend' })[0])
    expect(await screen.findByTestId('campaign-detail-location')).toHaveTextContent('')
  })

  it('opens the jobs report tab from Xem báo cáo', async () => {
    getCampaigns.mockResolvedValue([
      {
        public_id: 'camp_frontend',
        name: 'Tuyển Frontend',
        status: 'active',
        application_count: 3,
        job_count: 2,
        active_job_count: 1,
        pending_job_count: 1,
        unviewed_application_count: 1,
        updated_at: '2026-07-22T09:00:00Z',
      },
    ])
    renderPage()

    await screen.findAllByText('Xem báo cáo')
    fireEvent.click(screen.getAllByText('Xem báo cáo')[0])

    expect(await screen.findByTestId('campaign-detail-location')).toHaveTextContent('?active_tab=job')
  })
})
