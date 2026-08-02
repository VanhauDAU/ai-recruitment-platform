import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignOverviewPanel from './CampaignOverviewPanel'

const { getCampaignJobPerformance } = vi.hoisted(() => ({
  getCampaignJobPerformance: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    jobPerformance: (id, days) => ['campaigns', id, 'performance', days],
  },
  getCampaignJobPerformance,
}))

vi.mock('./CampaignPerformanceChart', () => ({
  default: ({ data }) => <div data-testid="campaign-performance-chart">{data.length} ngày dữ liệu</div>,
}))

const CAMPAIGN = {
  public_id: 'camp_frontend',
  candidate_count: 4,
  application_pair_count: 6,
  unviewed_count: 2,
  job_count: 5,
  active_job_count: 2,
  draft_job_count: 1,
  pending_job_count: 0,
  expired_job_count: 1,
  closed_job_count: 1,
  rejected_job_count: 0,
  accepted_count: 1,
}

function renderPanel(report, campaign = CAMPAIGN) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CampaignOverviewPanel campaign={campaign} report={report} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignOverviewPanel', () => {
  beforeEach(() => {
    getCampaignJobPerformance.mockResolvedValue({
      summary: {
        impressions: 1200,
        views: 360,
        applications: 24,
        view_rate: 30,
        application_rate: 6.67,
      },
      daily: [{ date: '2026-08-02', available: true, impressions: 1200, views: 360, applications: 24 }],
    })
  })

  it('presents real totals, the priority queue and status distribution without fake KPIs', async () => {
    renderPanel({
      candidate_count: 4,
      application_pair_count: 6,
      unviewed_count: 2,
      accepted_count: 1,
      jobs: { total: 5, active: 2, draft: 1, pending: 0, expired: 1, closed: 1, rejected: 0 },
      funnel: { submitted: 2, viewed: 1, considering: 1, shortlisted: 0, interviewed: 0, accepted: 1, rejected: 1 },
    })

    const candidates = screen.getByText('Ứng viên duy nhất').closest('article')
    expect(within(candidates).getByText('4')).toBeInTheDocument()
    const applications = screen.getByText('Hồ sơ ứng tuyển').closest('article')
    expect(within(applications).getByText('6')).toBeInTheDocument()
    expect(screen.getByText('CV mới chưa xem')).toBeInTheDocument()
    expect(screen.getByText('Tin đã hết hạn')).toBeInTheDocument()
    expect(screen.queryByText('Tin đang chờ duyệt')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Phân bổ 6 hồ sơ theo trạng thái' })).toBeInTheDocument()
    expect(screen.getByText('Tình trạng tin tuyển dụng')).toBeInTheDocument()
    expect(screen.queryByText(/credit/i)).not.toBeInTheDocument()

    expect(await screen.findByText('1.200')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByTestId('campaign-performance-chart')).toHaveTextContent('1 ngày dữ liệu')
  })

  it('shows a calm all-clear state when no action needs attention', async () => {
    renderPanel(
      {
        unviewed_count: 0,
        jobs: { total: 1, active: 1, draft: 0, pending: 0, expired: 0, closed: 0, rejected: 0 },
        funnel: {},
      },
      { ...CAMPAIGN, unviewed_count: 0, pending_job_count: 0, expired_job_count: 0 },
    )

    expect(screen.getByText('Mọi việc đang ổn')).toBeInTheDocument()
    expect(screen.getByText('Chưa có hồ sơ để phân bổ trạng thái')).toBeInTheDocument()
    expect(await screen.findByText('1.200')).toBeInTheDocument()
  })
})
