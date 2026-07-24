import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignLifecycleActions from './CampaignLifecycleActions'

const mocks = vi.hoisted(() => ({
  changeCampaignStatus: vi.fn(),
  getCampaignPauseImpact: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    all: ['campaigns'],
    pauseImpact: (id) => ['campaigns', 'pause-impact', id],
  },
  changeCampaignStatus: mocks.changeCampaignStatus,
  getCampaignPauseImpact: mocks.getCampaignPauseImpact,
}))

function renderActions(campaign = {
  public_id: 'camp_frontend',
  name: 'Tuyển Frontend',
  status: 'active',
}, props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CampaignLifecycleActions campaign={campaign} {...props} />
    </QueryClientProvider>,
  )
}

describe('CampaignLifecycleActions', () => {
  beforeEach(() => {
    mocks.changeCampaignStatus.mockReset().mockResolvedValue({ status: 'paused' })
    mocks.getCampaignPauseImpact.mockReset().mockResolvedValue({
      active_public_job_count: 1,
      active_public_jobs: [{ public_id: 'job_1', title: 'Frontend Engineer' }],
      active_services: [],
    })
  })

  it('loads pause impact and enables confirmation only for the exact campaign code', async () => {
    const user = userEvent.setup()
    renderActions()

    await user.click(screen.getByRole('button', { name: /dừng/i }))
    expect(await screen.findByText('1 tin đang công khai sẽ bị ẩn')).toBeInTheDocument()
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Xác nhận dừng' })
    const input = screen.getByRole('textbox')
    expect(confirm).toBeDisabled()

    await user.type(input, 'camp_frontend-wrong')
    expect(confirm).toBeDisabled()
    await user.clear(input)
    await user.type(input, 'camp_frontend')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(mocks.changeCampaignStatus).toHaveBeenCalledWith(
      'camp_frontend',
      'paused',
      'camp_frontend',
    ))
  })

  it('offers one-step resume only for a paused campaign', async () => {
    const user = userEvent.setup()
    renderActions({
      public_id: 'camp_frontend',
      name: 'Tuyển Frontend',
      status: 'paused',
    })

    await user.click(screen.getByRole('button', { name: /mở lại/i }))

    await waitFor(() => expect(mocks.changeCampaignStatus).toHaveBeenCalledWith(
      'camp_frontend',
      'active',
      undefined,
    ))
    expect(screen.queryByText('Dừng chiến dịch tuyển dụng')).not.toBeInTheDocument()
  })

  it('renders a compact switch that keeps the safe pause confirmation', async () => {
    const user = userEvent.setup()
    renderActions(undefined, { variant: 'switch' })

    const toggle = screen.getByRole('switch', { name: 'Dừng chiến dịch Tuyển Frontend' })
    expect(toggle).toBeChecked()
    await user.click(toggle)

    expect(await screen.findByText('1 tin đang công khai sẽ bị ẩn')).toBeInTheDocument()
    expect(mocks.changeCampaignStatus).not.toHaveBeenCalled()
  })
})
