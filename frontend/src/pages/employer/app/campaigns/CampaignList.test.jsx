import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { changeCampaignStatus, createCampaign, getCampaigns, getCampaignSuggestions } = vi.hoisted(() => ({
  changeCampaignStatus: vi.fn(),
  createCampaign: vi.fn(),
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
  createCampaign,
  createCampaignFromNeed: vi.fn(),
  getCampaigns,
  getCampaignSuggestions,
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tuyendung/app/campaigns']}>
        <Routes>
          <Route path="/tuyendung/app/campaigns" element={<CampaignList />} />
          <Route path="/tuyendung/app/jobs/new" element={<p>New job page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignList', () => {
  beforeEach(() => {
    createCampaign.mockReset()
    changeCampaignStatus.mockReset()
    getCampaigns.mockReset()
    getCampaignSuggestions.mockReset()
    getCampaigns.mockResolvedValue([])
    getCampaignSuggestions.mockResolvedValue([])
    createCampaign.mockResolvedValue({
      public_id: 'camp_q3',
      name: 'Tuyển dụng Quý 3/2026',
      status: 'active',
    })
  })

  it('creates from a name with Enter then asks the recruiter to choose an activity', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Thêm chiến dịch mới/ }))
    fireEvent.change(screen.getByLabelText('Tên chiến dịch tuyển dụng'), {
      target: { value: 'Tuyển dụng Quý 3/2026' },
    })
    fireEvent.keyDown(screen.getByLabelText('Tên chiến dịch tuyển dụng'), {
      key: 'Enter',
      code: 'Enter',
    })

    expect(await screen.findByText('Khởi động chiến dịch: Tuyển dụng Quý 3/2026')).toBeInTheDocument()
    expect(createCampaign).toHaveBeenCalledWith(
      { name: 'Tuyển dụng Quý 3/2026' },
      expect.anything(),
    )
    expect(screen.getByRole('button', { name: 'Xem chiến dịch' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin' }))
    expect(await screen.findByText('New job page')).toBeInTheDocument()
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
})
