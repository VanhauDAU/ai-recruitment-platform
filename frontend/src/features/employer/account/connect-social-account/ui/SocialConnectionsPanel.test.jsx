import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import SocialConnectionsPanel from './SocialConnectionsPanel'

const mocks = vi.hoisted(() => ({
  getSocialConnections: vi.fn(),
  startFacebookConnect: vi.fn(),
  getPendingFacebookPages: vi.fn(),
  selectFacebookPage: vi.fn(),
  disconnectSocialConnection: vi.fn(),
}))
vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))

function renderPanel(entry = '/tuyendung/app/account/settings/integrations') {
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
  })

  it('lists pages, flags the simulated provider and starts the Facebook OAuth redirect', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mocks.getSocialConnections.mockResolvedValue([
      { public_id: 'soc_1', page_name: 'Fanpage ProCV', status: 'connected', status_label: 'Đang kết nối', simulated: true },
    ])
    mocks.startFacebookConnect.mockResolvedValue('https://www.facebook.com/v21.0/dialog/oauth?state=x')
    renderPanel()

    expect(await screen.findByText('Fanpage ProCV')).toBeInTheDocument()
    expect(screen.getByText('Chế độ giả lập, không đăng lên Facebook thật')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Kết nối thêm Fanpage/ }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.facebook.com/v21.0/dialog/oauth?state=x'))
    vi.unstubAllGlobals()
  })

  it('lets the recruiter pick a page after returning from Facebook', async () => {
    const user = userEvent.setup()
    mocks.getSocialConnections.mockResolvedValue([])
    mocks.getPendingFacebookPages.mockResolvedValue([{ id: 'page_1', name: 'Tuyển dụng ProCV', picture_url: '' }])
    mocks.selectFacebookPage.mockResolvedValue({ public_id: 'soc_1', page_name: 'Tuyển dụng ProCV' })
    renderPanel('/tuyendung/app/account/settings/integrations?fb_select=nonce1')

    await user.click(await screen.findByRole('radio', { name: /Tuyển dụng ProCV/ }))
    await user.click(screen.getByRole('button', { name: 'Kết nối Fanpage' }))

    await waitFor(() => expect(mocks.selectFacebookPage).toHaveBeenCalledWith('nonce1', 'page_1'))
    expect(message.success).toHaveBeenCalledWith('Đã kết nối Fanpage "Tuyển dụng ProCV".')
  })

  it('explains a failed return from Facebook', async () => {
    mocks.getSocialConnections.mockResolvedValue([])
    renderPanel('/tuyendung/app/account/settings/integrations?fb_error=denied')

    expect(await screen.findByText(/Bạn chưa cấp quyền cho ProCV/)).toBeInTheDocument()
  })
})
