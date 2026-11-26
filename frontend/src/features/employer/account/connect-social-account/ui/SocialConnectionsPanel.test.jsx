import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import SocialConnectionsPanel from './SocialConnectionsPanel'

const mocks = vi.hoisted(() => ({
  getSocialConnections: vi.fn(),
  useSocialNetworks: vi.fn(),
  startSocialConnect: vi.fn(),
  getPendingSocialAccounts: vi.fn(),
  selectSocialAccount: vi.fn(),
  disconnectSocialConnection: vi.fn(),
}))
vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))

const facebook = {
  key: 'facebook_page',
  platform: 'Facebook',
  label: 'Fanpage Facebook',
  channel_kind: 'facebook_page',
  capabilities: { max_chars: 5000, max_images: 4, requires_image: false, supports_delete: true },
  simulated: true,
}

function renderPanel(entry = '/tuyendung/app/cai-dat/tich-hop') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <App><SocialConnectionsPanel /></App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SocialConnectionsPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    vi.spyOn(message, 'success').mockImplementation(() => {})
    mocks.useSocialNetworks.mockReturnValue({ data: [facebook], isLoading: false })
  })

  it('lists accounts per network, flags simulation and starts that network OAuth redirect', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mocks.getSocialConnections.mockResolvedValue([
      { public_id: 'soc_1', network: 'facebook_page', account_name: 'Fanpage ProCV', status: 'connected', status_label: 'Đang kết nối', simulated: true },
    ])
    mocks.startSocialConnect.mockResolvedValue('https://www.facebook.com/v21.0/dialog/oauth?state=x')
    renderPanel()

    const card = await screen.findByRole('region', { name: 'Fanpage Facebook' })
    expect(within(card).getByText('Fanpage ProCV')).toBeInTheDocument()
    expect(within(card).getByText('Giả lập, không đăng lên Facebook thật')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Kết nối thêm' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.facebook.com/v21.0/dialog/oauth?state=x'))
    expect(mocks.startSocialConnect.mock.calls[0][0]).toBe('facebook_page')
    vi.unstubAllGlobals()
  })

  it('lets the recruiter pick an account after returning from the network', async () => {
    const user = userEvent.setup()
    mocks.getSocialConnections.mockResolvedValue([])
    mocks.getPendingSocialAccounts.mockResolvedValue([{ id: 'page_1', name: 'Tuyển dụng ProCV', picture_url: '' }])
    mocks.selectSocialAccount.mockResolvedValue({ public_id: 'soc_1', account_name: 'Tuyển dụng ProCV' })
    renderPanel('/tuyendung/app/cai-dat/tich-hop?network=facebook_page&social_select=nonce1')

    const picker = await screen.findByRole('dialog')
    await user.click(await within(picker).findByRole('radio', { name: /Tuyển dụng ProCV/ }))
    await user.click(within(picker).getByRole('button', { name: 'Kết nối' }))

    await waitFor(() => expect(mocks.selectSocialAccount).toHaveBeenCalledWith('facebook_page', 'nonce1', 'page_1'))
    expect(message.success).toHaveBeenCalledWith('Đã kết nối Fanpage Facebook "Tuyển dụng ProCV".')
  })

  it('explains a failed return from the network', async () => {
    mocks.getSocialConnections.mockResolvedValue([])
    renderPanel('/tuyendung/app/cai-dat/tich-hop?network=facebook_page&social_error=denied')

    expect(await screen.findByText('Bạn chưa cấp quyền cho ProCV trên Facebook nên chưa kết nối được.')).toBeInTheDocument()
  })
})
