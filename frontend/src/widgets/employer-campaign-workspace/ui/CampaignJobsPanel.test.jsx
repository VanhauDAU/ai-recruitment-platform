import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignJobsPanel from './CampaignJobsPanel'

const mocks = vi.hoisted(() => ({ getCampaignJobPerformance: vi.fn() }))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    jobPerformance: (publicId, days, jobPublicId = '') => [
      'campaigns',
      'job-performance',
      publicId,
      days,
      jobPublicId || 'all',
    ],
  },
  getCampaignJobPerformance: mocks.getCampaignJobPerformance,
}))

function performance(days = 7, jobPublicId = '') {
  const jobs = [
    {
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
    },
    {
      public_id: 'job_2',
      slug: 'backend-engineer',
      title: 'Backend Engineer',
      status: 'closed',
      deadline: '2026-09-15',
      available: true,
      data_available_from: '2026-07-22',
      impressions: 50,
      views: 10,
      applications: 1,
      view_rate: 20,
      application_rate: 10,
    },
  ]
  const selectedJob = jobs.find((job) => job.public_id === jobPublicId)
  const summary = selectedJob
    ? {
        impressions: selectedJob.impressions,
        views: selectedJob.views,
        applications: selectedJob.applications,
        view_rate: selectedJob.view_rate,
        application_rate: selectedJob.application_rate,
      }
    : {
        impressions: 150,
        views: 30,
        applications: 6,
        view_rate: 20,
        application_rate: 20,
      }
  return {
    range: { days, start: '2026-07-16', end: '2026-07-22' },
    data_available_from: '2026-07-22',
    scope: {
      type: selectedJob ? 'job' : 'all_jobs',
      job_public_id: selectedJob?.public_id || null,
      job_title: selectedJob?.title || null,
      included_job_count: selectedJob ? 1 : jobs.length,
      total_job_count: jobs.length,
    },
    summary,
    daily: Array.from({ length: days }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, '0')}`,
      available: true,
      impressions: index === days - 1 ? summary.impressions : 0,
      views: index === days - 1 ? summary.views : 0,
      applications: index === days - 1 ? summary.applications : 0,
    })),
    jobs,
  }
}

function renderPanel(campaign) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CampaignJobsPanel publicId="camp_1" campaign={campaign} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignJobsPanel', () => {
  beforeEach(() => {
    mocks.getCampaignJobPerformance.mockReset().mockImplementation((_, days, jobPublicId) => (
      Promise.resolve(performance(days, jobPublicId))
    ))
  })

  it('defaults to the aggregate report and keeps per-job metrics in the table', async () => {
    renderPanel()

    expect(await screen.findByText('Báo cáo Tin tuyển dụng:')).toBeInTheDocument()
    expect(screen.getByText('Tất cả 2 tin trong chiến dịch')).toBeInTheDocument()
    expect(screen.getByText('Các chỉ số và biểu đồ đang tổng hợp toàn bộ 2 tin tuyển dụng.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Phạm vi báo cáo' })).not.toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Xem báo cáo Kỹ sư Frontend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem báo cáo Backend Engineer' })).toBeInTheDocument()
    expect(screen.getByText('Lượt hiển thị', { selector: 'p' }).closest('article')).toHaveTextContent('150')
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0)
    expect(screen.getByText(/bao gồm ứng tuyển lại/)).toBeInTheDocument()
  })

  it('opens one job report from its table row and can return to the aggregate report', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Tất cả 2 tin trong chiến dịch')

    await user.click(screen.getByRole('button', { name: 'Xem báo cáo Backend Engineer' }))

    await waitFor(() => expect(mocks.getCampaignJobPerformance).toHaveBeenLastCalledWith(
      'camp_1',
      7,
      'job_2',
    ))
    await waitFor(() => expect(screen.getByText('Lượt hiển thị', { selector: 'p' }).closest('article')).toHaveTextContent('50'))
    expect(screen.getByText('Các chỉ số và biểu đồ đang hiển thị riêng tin đã chọn.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem báo cáo Backend Engineer' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Xem báo cáo tổng hợp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem báo cáo Kỹ sư Frontend' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xem báo cáo tổng hợp' }))

    await waitFor(() => expect(screen.getByText('Tất cả 2 tin trong chiến dịch')).toBeInTheDocument())
    expect(screen.getByText('Lượt hiển thị', { selector: 'p' }).closest('article')).toHaveTextContent('150')
  })

  it('reloads the report when the recruiter selects 30 days', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Báo cáo Tin tuyển dụng:')

    await user.click(screen.getByRole('combobox', { name: 'Khoảng thời gian báo cáo' }))
    await user.click(await screen.findByText('30 ngày qua', { selector: '.ant-select-item-option-content' }))

    await waitFor(() => expect(mocks.getCampaignJobPerformance).toHaveBeenLastCalledWith('camp_1', 30, ''))
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

  it('keeps editing and add-job actions available while warning that public jobs are hidden', async () => {
    renderPanel({ public_id: 'camp_1', status: 'paused' })

    expect(await screen.findByText('Chiến dịch đang tắt')).toBeInTheDocument()
    expect(await screen.findByText('Đang ẩn theo chiến dịch')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thêm tin tuyển dụng' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/new?campaign=camp_1',
    )
    expect(await screen.findByRole('link', {
      name: 'Chỉnh sửa Kỹ sư Frontend',
    })).toBeInTheDocument()
    expect(screen.getByLabelText('Xem tin Kỹ sư Frontend')).toHaveAttribute(
      'aria-disabled',
      'true',
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
