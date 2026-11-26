import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import AddChannelModal from './AddChannelModal'

const mocks = vi.hoisted(() => ({
  getCampaignChannels: vi.fn(),
  createCampaignChannel: vi.fn(),
  getSocialConnections: vi.fn(),
  useSocialNetworks: vi.fn(),
}))

vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({
  ...(await importOriginal()),
  getCampaignChannels: mocks.getCampaignChannels,
  createCampaignChannel: mocks.createCampaignChannel,
  getSocialConnections: mocks.getSocialConnections,
  useSocialNetworks: mocks.useSocialNetworks,
}))

const network = (key, label, channelKind = key) => ({
  key, label, platform: label, channel_kind: channelKind, simulated: false,
  capabilities: { max_chars: 500, max_images: 4, requires_image: false, supports_delete: true, image_ratio: null },
})
const NETWORKS = [
  network('facebook_page', 'Fanpage Facebook'),
  network('instagram', 'Instagram doanh nghiệp'),
  network('threads', 'Threads'),
  network('linkedin', 'Trang cá nhân LinkedIn'),
]

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><App><AddChannelModal campaign={{ public_id: 'camp_1' }} open onClose={() => {}} /></App></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AddChannelModal', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    vi.spyOn(message, 'success').mockImplementation(() => {})
    mocks.getCampaignChannels.mockResolvedValue([{ public_id: 'chn_1', kind: 'facebook_page', label: 'Fanpage Facebook' }])
    mocks.createCampaignChannel.mockResolvedValue({ public_id: 'chn_2' })
    mocks.useSocialNetworks.mockReturnValue({ data: NETWORKS, isLoading: false })
    mocks.getSocialConnections.mockResolvedValue([
      { public_id: 'soc_1', network: 'facebook_page', account_name: 'Propos', status: 'connected' },
    ])
  })

  it('splits channels into ProCV posts and you post, with each network connection state', async () => {
    renderModal()

    const auto = await screen.findByRole('region', { name: 'ProCV tự đăng' })
    const manual = screen.getByRole('region', { name: 'Bạn tự đăng' })
    expect(within(auto).getAllByRole('radio').map((tile) => tile.textContent)).toEqual([
      'Fanpage FacebookĐã kết nối · Propos',
      'InstagramChưa kết nối',
      'ThreadsChưa kết nối',
      'LinkedInChưa kết nối',
    ])
    expect(within(manual).getByRole('radio', { name: /Nhóm Facebook/ })).toBeInTheDocument()
    expect(within(manual).queryByRole('radio', { name: /LinkedIn/ })).not.toBeInTheDocument()
  })

  it('points to the integrations page when the picked network is not connected', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Threads/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Chưa kết nối Threads: tới khi kết nối')
    expect(screen.getByRole('link', { name: 'Kết nối ngay' }))
      .toHaveAttribute('href', '/tuyendung/app/cai-dat/tich-hop')
    await user.click(screen.getByRole('radio', { name: /Fanpage Facebook/ }))
    expect(screen.queryByRole('link', { name: 'Kết nối ngay' })).not.toBeInTheDocument()
  })

  it('adds a channel by place only and suggests a name that is not taken', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.getCampaignChannels).toHaveBeenCalled())

    expect(screen.queryByText('Link dẫn tới')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('radio', { name: /Fanpage Facebook/ }))
    expect(screen.getByLabelText('Tên để phân biệt')).toHaveValue('Fanpage Facebook 2')

    await user.click(screen.getByRole('button', { name: 'Thêm kênh' }))
    await waitFor(() => expect(mocks.createCampaignChannel).toHaveBeenCalledWith('camp_1', {
      kind: 'facebook_page', label: 'Fanpage Facebook 2',
    }))
  })

  it('blocks a typed name that another channel already uses', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.getCampaignChannels).toHaveBeenCalled())
    await user.click(await screen.findByRole('radio', { name: /Fanpage Facebook/ }))
    const label = screen.getByLabelText('Tên để phân biệt')
    await user.clear(label)
    await user.type(label, 'fanpage facebook')
    await user.click(screen.getByRole('button', { name: 'Thêm kênh' }))

    expect(await screen.findByText(/Chiến dịch đã có kênh cùng tên/)).toBeInTheDocument()
    expect(mocks.createCampaignChannel).not.toHaveBeenCalled()
  })
})
