import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import CampaignJobSelection from './CampaignJobSelection'
import CampaignLaunchReview from './CampaignLaunchReview'

const mocks = vi.hoisted(() => ({
  saveCampaignLaunchSelection: vi.fn(),
  launchCampaign: vi.fn(),
  getJobPostingContext: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: { all: ['campaigns'], launch: (id) => ['campaigns', 'launch', id] },
  saveCampaignLaunchSelection: mocks.saveCampaignLaunchSelection,
  launchCampaign: mocks.launchCampaign,
}))
vi.mock('@/entities/job', () => ({
  jobKeys: { postingContext: ['jobs', 'posting-context'] },
  getJobPostingContext: mocks.getJobPostingContext,
}))

const campaign = { public_id: 'camp_1', name: 'Tuyển Backend', status: 'draft', start_date: '2026-12-01' }
const overview = {
  statement_version: '2026-11',
  can_schedule: true,
  last_error: {},
  draft_jobs: [{ public_id: 'job_draft', title: 'Backend nháp', action: 'publish', deadline: '2026-12-20' }],
  attachable_jobs: [{ public_id: 'job_live', title: 'Backend đang tuyển', action: '', deadline: null }],
  campaign_jobs: [],
  check: {
    ready: true,
    job_problems: [],
    items: [{ code: 'goal', label: 'Mục tiêu: vị trí và chỉ tiêu tuyển', ok: true, detail: '' }],
  },
}

function renderWithClient(component) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('campaign launch steps', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getJobPostingContext.mockResolvedValue({ responsibility_statement: { text: 'Tôi cam kết nội dung tin.' } })
    vi.spyOn(message, 'success').mockImplementation(() => {})
    vi.spyOn(message, 'error').mockImplementation(() => {})
  })

  it('saves the drafts to publish and the public jobs to attach', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mocks.saveCampaignLaunchSelection.mockResolvedValue(overview)
    renderWithClient(<CampaignJobSelection campaign={campaign} overview={overview} onSaved={onSaved} />)

    await user.click(screen.getByLabelText('Chọn Backend đang tuyển'))
    await user.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(mocks.saveCampaignLaunchSelection).toHaveBeenCalledWith('camp_1', {
      publishJobIds: ['job_draft'],
      attachJobIds: ['job_live'],
    })
    expect(screen.getByRole('link', { name: 'Tạo tin nháp mới' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/new?campaign=camp_1&return=setup',
    )
  })

  it('launches only after the commitment is accepted, in the chosen mode', async () => {
    const user = userEvent.setup()
    const onLaunched = vi.fn()
    mocks.launchCampaign.mockResolvedValue({ public_id: 'camp_1', status: 'scheduled' })
    renderWithClient(<CampaignLaunchReview campaign={campaign} overview={overview} onLaunched={onLaunched} />)

    const submit = screen.getByRole('button', { name: 'Kích hoạt chiến dịch' })
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Lên lịch/ }))
    await user.click(await screen.findByText('Tôi cam kết nội dung tin.'))
    await user.click(screen.getByRole('button', { name: 'Lên lịch kích hoạt' }))

    await waitFor(() => expect(onLaunched).toHaveBeenCalled())
    expect(mocks.launchCampaign).toHaveBeenCalledWith('camp_1', {
      mode: 'scheduled',
      acceptedStatementVersion: '2026-11',
    })
  })

  it('keeps launch disabled and lists what blocks a not-ready campaign', () => {
    renderWithClient(
      <CampaignLaunchReview
        campaign={campaign}
        overview={{
          ...overview,
          can_schedule: false,
          check: {
            ready: false,
            items: [{ code: 'jobs', label: 'Có ít nhất một tin tuyển dụng', ok: false, detail: 'Chọn tin.' }],
            job_problems: [{ public_id: 'job_draft', title: 'Backend nháp', problems: ['Tin nháp còn thiếu: benefits'] }],
          },
        }}
      />,
    )

    expect(screen.getByText('Chọn tin.')).toBeInTheDocument()
    expect(screen.getByText('Tin nháp còn thiếu: benefits')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Lên lịch/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Kích hoạt chiến dịch' })).toBeDisabled()
  })
})
