import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { createCampaign, getCampaigns, getCampaignSuggestions } = vi.hoisted(() => ({
  createCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  getCampaignSuggestions: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  CAMPAIGN_STATUS_LABELS: { draft: 'Nháp' },
  campaignKeys: { all: ['campaigns'], list: () => ['campaigns', 'list'] },
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
    getCampaigns.mockReset()
    getCampaignSuggestions.mockReset()
    getCampaigns.mockResolvedValue([])
    getCampaignSuggestions.mockResolvedValue([])
    createCampaign.mockResolvedValue({
      public_id: 'camp_q3',
      name: 'Tuyển dụng Quý 3/2026',
      status: 'draft',
    })
  })

  it('creates from a name with Enter then asks the recruiter to choose an activity', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Tạo chiến dịch/ }))
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
    expect(screen.getByRole('button', { name: 'Sắp mở' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin' }))
    expect(await screen.findByText('New job page')).toBeInTheDocument()
  })
})
