import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import CampaignHealthPanel from './CampaignHealthPanel'

const { getCampaignHealth } = vi.hoisted(() => ({ getCampaignHealth: vi.fn() }))
vi.mock('@/entities/campaign', () => ({
  campaignKeys: { health: (id) => ['campaigns', 'health', id] },
  getCampaignHealth,
}))
vi.mock('@/features/export-campaign-report', () => ({
  CampaignReportExport: () => <button type="button">Tải Excel</button>,
}))

const HEALTH = {
  status: 'off_track',
  headcount: 20,
  accepted: 2,
  applications: 10,
  days_left: 20,
  velocity_7d: 1.14,
  velocity_all: 1,
  hire_rate: 0.125,
  stage_rates: { new: 0.05, shortlisted: 0.2, interviewed: 0.4 },
  stage_rate_sources: { new: 'default', shortlisted: 'default', interviewed: 'default' },
  pipeline: { new: 3, shortlisted: 1, interviewed: 2 },
  forecast: 6,
  required_velocity: 6.74,
  funnel: [
    { stage: 'applied', count: 10, percent_of_applications: 100 },
    { stage: 'viewed', count: 7, percent_of_applications: 70 },
    { stage: 'accepted', count: 2, percent_of_applications: 20 },
  ],
  response: { median_hours_to_view: 5, viewed_within_48h_percent: 66.7, backlog: 6 },
  budget: { spent: 6000000, budget_max: 10000000, used_percent: 60, burn_ratio: 1.86 },
  silent_channels: [{ label: 'Nhóm IT', clicks: 0 }],
  alerts: ['forecast_at_risk', 'backlog', 'channel_zero_apply', 'budget_overburn'],
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CampaignHealthPanel campaign={{ public_id: 'camp_1', target_date: '2026-12-08' }} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignHealthPanel', () => {
  it('explains the forecast, the gap and what to do next', async () => {
    getCampaignHealth.mockResolvedValue({ health: HEALTH, history: [] })
    renderPanel()

    expect(await screen.findByRole('heading', { name: 'Chậm tiến độ' })).toBeInTheDocument()
    expect(screen.getByText('Dự báo tuyển được khoảng 6/20 người trước 08/12/2026.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '4 điều cần chú ý' })).toBeInTheDocument()
    expect(screen.getByText('6 hồ sơ chờ xem quá 48 giờ')).toBeInTheDocument()
    expect(screen.getByText('Nhóm IT (0 lượt bấm)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem CV →' })).toHaveAttribute('href', '/?active_tab=apply_cv')
    expect(screen.getByText('66,7%')).toBeInTheDocument()
    expect(screen.getByText('Biểu đồ xuất hiện sau 2 ngày theo dõi.')).toBeInTheDocument()
  })

  it('does not judge a campaign without enough data', async () => {
    getCampaignHealth.mockResolvedValue({
      health: { ...HEALTH, status: 'insufficient_data', alerts: [], required_velocity: null },
      history: [],
    })
    renderPanel()

    expect(await screen.findByRole('heading', { name: 'Chưa đủ dữ liệu' })).toBeInTheDocument()
    expect(screen.queryByText(/CV\/ngày/)).not.toBeInTheDocument()
    expect(screen.queryByText(/điều cần chú ý/)).not.toBeInTheDocument()
  })
})
