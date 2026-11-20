import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import AddChannelModal from './AddChannelModal'

const mocks = vi.hoisted(() => ({
  getCampaignChannels: vi.fn(),
  createCampaignChannel: vi.fn(),
}))

vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({
  ...(await importOriginal()),
  getCampaignChannels: mocks.getCampaignChannels,
  createCampaignChannel: mocks.createCampaignChannel,
}))

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App><AddChannelModal campaign={{ public_id: 'camp_1' }} open onClose={() => {}} /></App>
    </QueryClientProvider>,
  )
}

describe('AddChannelModal', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    vi.spyOn(message, 'success').mockImplementation(() => {})
    mocks.getCampaignChannels.mockResolvedValue([{ public_id: 'chn_1', kind: 'facebook_page', label: 'Fanpage Facebook' }])
    mocks.createCampaignChannel.mockResolvedValue({ public_id: 'chn_2' })
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
