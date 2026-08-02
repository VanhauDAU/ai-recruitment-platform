import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignActivityPanel from './CampaignActivityPanel'

const mocks = vi.hoisted(() => ({
  getCampaignActivities: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    activities: (publicId, params) => ['campaigns', 'activities', publicId, params],
  },
  getCampaignActivities: mocks.getCampaignActivities,
}))

const ACTIVITIES = [
  {
    id: 1,
    group: 'application',
    group_label: 'Ứng viên',
    event_type: 'application_status_changed',
    event_label: 'Đổi trạng thái ứng viên',
    actor_name: '',
    subject_public_id: 'app_1',
    metadata: {
      candidate_name: 'Nguyễn An',
      job_title: 'Kỹ sư Frontend',
      from_status: 'submitted',
      to_status: 'viewed',
    },
    occurred_at: '2026-07-22T09:30:00+07:00',
  },
  {
    id: 2,
    group: 'job',
    group_label: 'Tin tuyển dụng',
    event_type: 'job_updated',
    event_label: 'Cập nhật tin tuyển dụng',
    actor_name: 'Recruiter A',
    subject_public_id: 'job_1',
    metadata: {
      title: 'Kỹ sư Backend',
      deadline: '2026-08-31',
    },
    occurred_at: '2026-07-22T08:15:00+07:00',
  },
  {
    id: 3,
    group: 'campaign',
    group_label: 'Chiến dịch',
    event_type: 'campaign_updated',
    event_label: 'Cập nhật chiến dịch',
    actor_name: 'Recruiter A',
    subject_public_id: '',
    metadata: { fields: ['name'] },
    occurred_at: '2026-07-21T16:00:00+07:00',
  },
  {
    id: 4,
    group: 'campaign',
    group_label: 'Chiến dịch',
    event_type: 'account_policy_held',
    event_label: 'Giữ do trạng thái tài khoản',
    actor_name: null,
    subject_public_id: '',
    metadata: { reason: 'account_status_policy_hold' },
    occurred_at: '2026-07-21T15:00:00+07:00',
  },
]

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CampaignActivityPanel publicId="camp_1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignActivityPanel', () => {
  beforeEach(() => {
    mocks.getCampaignActivities.mockReset().mockResolvedValue({
      count: ACTIVITIES.length,
      next: null,
      previous: null,
      results: ACTIVITIES,
    })
  })

  it('groups activities by Vietnam date and renders real metadata with links', async () => {
    renderPanel()

    const latestDay = await screen.findByTestId('activity-day-2026-07-22')
    const previousDay = screen.getByTestId('activity-day-2026-07-21')

    expect(within(latestDay).getByText('2 hoạt động')).toBeInTheDocument()
    expect(within(previousDay).getByText('2 hoạt động')).toBeInTheDocument()
    expect(within(latestDay).getByText('Nguyễn An · Kỹ sư Frontend')).toHaveAttribute(
      'href',
      '/tuyendung/app/applications?campaign=camp_1&application=app_1',
    )
    expect(within(latestDay).getByLabelText(
      'Chuyển trạng thái từ Tiếp nhận sang Đã xem',
    )).toBeInTheDocument()
    expect(within(latestDay).getByText('Kỹ sư Backend')).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/job_1',
    )
    expect(within(latestDay).getByText('31/08/2026')).toBeInTheDocument()
    expect(within(previousDay).getByText('Tạm giữ theo trạng thái tài khoản')).toBeInTheDocument()
    expect(screen.getAllByText('Hệ thống')).toHaveLength(2)
  })

  it('keeps page and group in the existing activity query contract', async () => {
    const user = userEvent.setup()
    mocks.getCampaignActivities.mockImplementation((_, params) => Promise.resolve({
      count: 21,
      next: params.page === 1 ? '?page=2' : null,
      previous: params.page === 2 ? '?page=1' : null,
      results: [ACTIVITIES[0]],
    }))
    renderPanel()

    await screen.findByTestId('activity-day-2026-07-22')
    await user.click(screen.getByTitle('2'))
    await waitFor(() => expect(mocks.getCampaignActivities).toHaveBeenLastCalledWith(
      'camp_1',
      { page: 2 },
    ))

    await user.click(screen.getByRole('combobox', { name: 'Lọc nhóm hoạt động' }))
    await user.click(await screen.findByText('Tin tuyển dụng', {
      selector: '.ant-select-item-option-content',
    }))

    await waitFor(() => expect(mocks.getCampaignActivities).toHaveBeenLastCalledWith(
      'camp_1',
      { page: 1, group: 'job' },
    ))
  })

  it('preserves retry and empty states', async () => {
    const user = userEvent.setup()
    mocks.getCampaignActivities
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] })
    renderPanel()

    expect(await screen.findByText('Không thể tải lịch sử hoạt động')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Chưa có hoạt động phù hợp')).toBeInTheDocument()
    expect(mocks.getCampaignActivities).toHaveBeenCalledTimes(2)
  })
})
