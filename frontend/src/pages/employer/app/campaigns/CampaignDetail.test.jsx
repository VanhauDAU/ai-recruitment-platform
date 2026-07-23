import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignDetail from './CampaignDetail'

const { getCampaign, getCampaignJobPerformance, getCampaignReport } = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignJobPerformance: vi.fn(),
  getCampaignReport: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  CAMPAIGN_STATUS_COLORS: { active: 'green' },
  CAMPAIGN_STATUS_LABELS: { active: 'Đang mở' },
  campaignKeys: {
    all: ['campaigns'],
    detail: (id) => ['campaigns', 'detail', id],
    jobPerformance: (id, days) => ['campaigns', 'job-performance', id, days],
    report: (id) => ['campaigns', 'report', id],
  },
  getCampaign,
  getCampaignJobPerformance,
  getCampaignReport,
  updateCampaign: vi.fn(),
}))
vi.mock('@/features/manage-campaigns', () => ({
  CampaignNameForm: ({ initialName }) => <p>Sửa chiến dịch {initialName}</p>,
  CampaignLifecycleActions: () => <button type="button">Dừng</button>,
}))

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
      status_label: 'Đang mở',
      created_at: '2026-07-20T08:00:00Z',
      updated_at: '2026-07-22T09:00:00Z',
      last_activity: {
        label: 'Nhận CV ứng tuyển',
        occurred_at: '2026-07-22T09:00:00Z',
      },
      job_count: 2,
      active_job_count: 1,
      application_count: 7,
      application_pair_count: 5,
    })
    getCampaignReport.mockResolvedValue({
      application_pair_count: 5,
      applications: { total: 7, new: 2 },
      jobs: { total: 2, active: 1 },
      funnel: { submitted: 2, considering: 2, accepted: 1 },
    })
    getCampaignJobPerformance.mockResolvedValue({
      summary: {
        impressions: 100,
        views: 20,
        applications: 5,
        view_rate: 20,
        application_rate: 25,
      },
      daily: [],
      jobs: [{
        public_id: 'job_frontend',
        slug: 'frontend-engineer',
        title: 'Frontend Engineer',
        status: 'active',
        available: true,
        impressions: 100,
        views: 20,
        applications: 5,
        view_rate: 20,
        application_rate: 25,
      }],
    })
  })

  it('renders only the four real-data tabs and unambiguous KPIs', async () => {
    renderPage()

    expect(await screen.findByText('Ứng viên duy nhất')).toBeInTheDocument()
    expect(screen.getByText('Hồ sơ ứng tuyển')).toBeInTheDocument()
    expect(screen.queryByText('CV đã kết nối')).not.toBeInTheDocument()
    expect(screen.queryByText('Số credit đã sử dụng')).not.toBeInTheDocument()
    expect(screen.queryByText(/Insight/)).not.toBeInTheDocument()
    expect(screen.getByText('Tin đang tuyển')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'CV ứng tuyển' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tin tuyển dụng' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lịch sử hoạt động' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Ứng viên đã xem tin' })).not.toBeInTheDocument()
  })

  it('opens the compact campaign editor', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa chiến dịch' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Sửa chiến dịch', { selector: '.ant-modal-title *' })).toBeInTheDocument()
    expect(screen.getByText('Sửa chiến dịch Tuyển Frontend')).toBeInTheDocument()
  })

  it('switches content and keeps active_tab in the URL', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Tin tuyển dụng' }))

    await waitFor(() => expect(screen.getByText('Báo cáo Tin tuyển dụng:')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Tin tuyển dụng' })).toHaveAttribute('aria-selected', 'true')
  })
})
