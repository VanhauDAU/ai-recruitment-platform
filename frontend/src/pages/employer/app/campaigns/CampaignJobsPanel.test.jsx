import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignJobsPanel from './CampaignJobsPanel'

const mocks = vi.hoisted(() => ({ getCampaignJobPerformance: vi.fn() }))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    jobPerformance: (publicId, days) => ['campaigns', 'job-performance', publicId, days],
  },
  getCampaignJobPerformance: mocks.getCampaignJobPerformance,
}))

function performance(days = 7) {
  return {
    range: { days, start: '2026-07-16', end: '2026-07-22' },
    data_available_from: '2026-07-22',
    summary: {
      impressions: 100,
      views: 20,
      applications: 5,
      view_rate: 20,
      application_rate: 25,
    },
    daily: Array.from({ length: days }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, '0')}`,
      available: true,
      impressions: index + 1,
      views: index % 2,
      applications: 0,
    })),
    jobs: [{
      public_id: 'job_1',
      slug: 'ky-su-frontend',
      title: 'Kỹ sư Frontend',
      status: 'active',
      deadline: '2026-08-31',
      available: true,
      data_available_from: '2026-07-22',
      impressions: 100,
      views: 20,
      applications: 5,
      view_rate: 20,
      application_rate: 25,
    }],
  }
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CampaignJobsPanel publicId="camp_1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignJobsPanel', () => {
  beforeEach(() => {
    mocks.getCampaignJobPerformance.mockReset().mockImplementation((_, days) => Promise.resolve(performance(days)))
  })

  it('renders the three-series report and period-aligned job metrics', async () => {
    renderPanel()

    expect(await screen.findByText('Báo cáo Tin tuyển dụng:')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thêm tin tuyển dụng' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/new?campaign=camp_1',
    )
    expect(screen.getByRole('img', { name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Số lần hiển thị' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Tỷ lệ xem tin/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem tin Kỹ sư Frontend' })).toHaveAttribute(
      'href',
      '/viec-lam/ky-su-frontend',
    )
    expect(screen.getByRole('link', { name: 'Xem tin Kỹ sư Frontend' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Chỉnh sửa Kỹ sư Frontend' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/job_1/edit',
    )
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0)
    expect(screen.getByText(/bao gồm ứng tuyển lại/)).toBeInTheDocument()
  })

  it('reloads the report when the recruiter selects 30 days', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Báo cáo Tin tuyển dụng:')

    await user.click(screen.getByRole('combobox', { name: 'Khoảng thời gian báo cáo' }))
    await user.click(await screen.findByText('30 ngày qua', { selector: '.ant-select-item-option-content' }))

    await waitFor(() => expect(mocks.getCampaignJobPerformance).toHaveBeenLastCalledWith('camp_1', 30))
  })

  it('shows unavailable values as dashes instead of false zeroes', async () => {
    const unavailable = performance()
    unavailable.jobs[0] = {
      ...unavailable.jobs[0],
      available: false,
      impressions: 0,
      views: 0,
      applications: 0,
      view_rate: null,
      application_rate: null,
    }
    unavailable.daily = unavailable.daily.map((item) => ({
      ...item,
      available: false,
      impressions: null,
      views: null,
      applications: null,
    }))
    mocks.getCampaignJobPerformance.mockResolvedValue(unavailable)

    renderPanel()

    expect(await screen.findByText('Chưa đến thời điểm bắt đầu ghi nhận dữ liệu')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5)
  })

  it('keeps the add-job action available when the report cannot load', async () => {
    mocks.getCampaignJobPerformance.mockRejectedValue(new Error('Network error'))
    renderPanel()

    expect(await screen.findByText('Không thể tải báo cáo tin tuyển dụng')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thêm tin tuyển dụng' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/new?campaign=camp_1',
    )
  })

  it('shows the rejection reason for a rejected job', async () => {
    const user = userEvent.setup()
    const rejected = performance()
    rejected.jobs[0] = {
      ...rejected.jobs[0],
      status: 'rejected',
      rejected_reason: 'Thiếu thông tin về mức lương và quyền lợi.',
    }
    mocks.getCampaignJobPerformance.mockResolvedValue(rejected)
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Xem lý do từ chối Kỹ sư Frontend' }))
    expect(screen.getByText('Thiếu thông tin về mức lương và quyền lợi.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chỉnh sửa và gửi lại' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/job_1/edit',
    )
  })
})
