import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import CampaignChannelBoard from './CampaignChannelBoard'
import ChannelReport from './ChannelReport'

const mocks = vi.hoisted(() => ({
  getCampaignChannels: vi.fn(),
  generateCampaignChannelContent: vi.fn(),
  updateCampaignChannel: vi.fn(),
  getCampaignChannelReport: vi.fn(),
}))

vi.mock('@/entities/campaign', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))

const campaign = { public_id: 'camp_1', status: 'active' }
const channel = {
  public_id: 'chn_1',
  kind: 'facebook_group',
  kind_label: 'Nhóm Facebook',
  label: 'Nhóm IT Hà Nội',
  link: 'https://procv.vn/r/AbC123xy',
  target: 'landing',
  content: {},
  rendered_content: {},
  posted_at: null,
  posted_url: '',
  clicks: 12,
  unique_clicks: 10,
  applications: 2,
  hires: 1,
  cost: 2000000,
}

function renderWithClient(component) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>{component}</App>
    </QueryClientProvider>,
  )
}

describe('campaign channels', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    vi.spyOn(message, 'success').mockImplementation(() => {})
    vi.spyOn(message, 'info').mockImplementation(() => {})
  })

  it('shows each channel with its tracked link and results, and drafts content with AI', async () => {
    const user = userEvent.setup()
    mocks.getCampaignChannels.mockResolvedValue([channel])
    mocks.generateCampaignChannelContent.mockResolvedValue({ ...channel, fallback_reason: 'ai_disabled' })
    renderWithClient(<CampaignChannelBoard campaign={campaign} />)

    const card = (await screen.findByRole('heading', { name: 'Nhóm IT Hà Nội' })).closest('article')
    expect(within(card).getByText('https://procv.vn/r/AbC123xy')).toBeInTheDocument()
    expect(within(card).getByText('2.000.000 đ')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: /Soạn bằng AI/ }))

    await waitFor(() => expect(mocks.generateCampaignChannelContent).toHaveBeenCalledWith('camp_1', 'chn_1'))
    expect(message.info).toHaveBeenCalledWith('AI đang tắt nên dùng mẫu có sẵn. Bạn có thể sửa lại.')
  })

  it('marks a channel as posted', async () => {
    const user = userEvent.setup()
    mocks.getCampaignChannels.mockResolvedValue([channel])
    mocks.updateCampaignChannel.mockResolvedValue({ ...channel, posted_at: '2026-11-18T10:00:00Z' })
    renderWithClient(<CampaignChannelBoard campaign={campaign} />)

    await user.click(await screen.findByRole('checkbox', { name: 'Đã đăng lên kênh này' }))

    await waitFor(() => expect(mocks.updateCampaignChannel).toHaveBeenCalledWith('camp_1', 'chn_1', { posted: true }))
  })

  it('hides editing on an ended campaign and explains an empty board', async () => {
    mocks.getCampaignChannels.mockResolvedValue([])
    renderWithClient(<CampaignChannelBoard campaign={{ ...campaign, status: 'completed' }} />)

    expect(await screen.findByText('Chưa có kênh nào')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thêm kênh/ })).not.toBeInTheDocument()
  })

  it('compares channels and organic sources with totals against the budget', async () => {
    mocks.getCampaignChannelReport.mockResolvedValue({
      rows: [
        { key: 'chn_1', label: 'Nhóm IT Hà Nội', kind: 'facebook_group', unique_clicks: 10, applications: 2, apply_rate: 20, hires: 1, cost: 2000000, cost_per_application: 1000000, cost_per_hire: 2000000 },
        { key: 'organic:applied', label: 'Tự tìm thấy trên ProCV', kind: 'organic', unique_clicks: null, applications: 1, apply_rate: null, hires: 0, cost: 0, cost_per_application: null, cost_per_hire: null },
      ],
      totals: { applications: 3, hires: 1, cost: 2000000, cost_per_application: 666667, cost_per_hire: 2000000, budget_used_percent: 20 },
    })
    renderWithClient(<ChannelReport campaignId="camp_1" />)

    const row = (await screen.findByText('Nhóm IT Hà Nội')).closest('tr')
    expect(within(row).getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('Không qua link theo dõi')).toBeInTheDocument()
    expect(screen.getByText(/20% ngân sách/)).toBeInTheDocument()
  })
})
