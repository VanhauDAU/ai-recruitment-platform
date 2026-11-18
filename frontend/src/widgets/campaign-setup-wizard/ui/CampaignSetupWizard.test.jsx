import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignSetupWizard from './CampaignSetupWizard'

const mocks = vi.hoisted(() => ({ getCampaign: vi.fn(), getCampaignLaunch: vi.fn() }))

vi.mock('@/entities/campaign', () => ({
  CAMPAIGN_SETUP_STATUSES: ['draft', 'scheduled'],
  CAMPAIGN_STATUS_LABELS: { draft: 'Nháp', active: 'Đang mở' },
  campaignKeys: { detail: (id) => ['campaigns', 'detail', id] },
  getCampaign: mocks.getCampaign,
}))
vi.mock('@/features/launch-campaign', () => ({
  SETUP_STEPS: [
    { key: 'goal', title: 'Thông tin' },
    { key: 'jobs', title: 'Tin tuyển dụng' },
    { key: 'launch', title: 'Kích hoạt' },
  ],
  setupStepStates: () => ({
    goal: { done: true, summary: 'Đến 31/12' },
    jobs: { done: false, summary: 'Chưa chọn tin nào' },
    launch: { done: false, ready: false, summary: 'Còn 1 điều kiện chưa đạt' },
  }),
  useCampaignLaunch: () => ({ isLoading: false, data: { draft_jobs: [] }, error: null }),
  CampaignJobSelection: () => <p>Bước chọn tin</p>,
  CampaignLaunchReview: () => <p>Bước kích hoạt</p>,
}))
vi.mock('@/features/manage-campaigns', () => ({
  CampaignInfoForm: ({ onSaved }) => <button type="button" onClick={onSaved}>Lưu mục tiêu giả</button>,
}))

function Search() {
  return <span data-testid="search">{useLocation().search}</span>
}

function renderWizard(entry = '/tuyendung/app/campaigns/camp_1/setup') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/tuyendung/app/campaigns/:publicId/setup"
            element={<><CampaignSetupWizard publicId="camp_1" /><Search /></>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignSetupWizard', () => {
  beforeEach(() => mocks.getCampaign.mockReset())

  it('walks a draft from the goal step to the job step through the URL', async () => {
    const user = userEvent.setup()
    mocks.getCampaign.mockResolvedValue({ public_id: 'camp_1', name: 'Tuyển Backend', status: 'draft' })
    renderWizard()

    await user.click(await screen.findByRole('button', { name: 'Lưu mục tiêu giả' }))

    expect(await screen.findByText('Bước chọn tin')).toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent('?step=jobs')
    expect(screen.getByRole('button', { name: /Tin tuyển dụng/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Chưa chọn tin nào')).toBeInTheDocument()
  })

  it('jumps to a step from the rail', async () => {
    const user = userEvent.setup()
    mocks.getCampaign.mockResolvedValue({ public_id: 'camp_1', name: 'Tuyển Backend', status: 'draft' })
    renderWizard()

    await user.click(await screen.findByRole('button', { name: /Kích hoạt/ }))

    expect(await screen.findByText('Bước kích hoạt')).toBeInTheDocument()
  })

  it('opens the requested step and refuses setup once the campaign runs', async () => {
    mocks.getCampaign.mockResolvedValue({ public_id: 'camp_1', name: 'Tuyển Backend', status: 'active' })
    renderWizard('/tuyendung/app/campaigns/camp_1/setup?step=launch')

    expect(await screen.findByText('Chiến dịch đã chạy, không còn ở bước thiết lập.')).toBeInTheDocument()
    expect(screen.queryByText('Bước kích hoạt')).not.toBeInTheDocument()
  })
})
