import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import ChannelFacebookPosts from './ChannelFacebookPosts'

const mocks = vi.hoisted(() => ({
  getChannelPosts: vi.fn(),
  getSocialConnections: vi.fn(),
  scheduleChannelPost: vi.fn(),
  cancelChannelPost: vi.fn(),
  rescheduleChannelPost: vi.fn(),
}))
vi.mock('@/entities/campaign', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))

const channel = { public_id: 'chn_1', kind: 'facebook_page' }

function renderPosts(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChannelFacebookPosts campaignId="camp_1" channel={channel} editable defaultMessage="Tuyển gấp" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ChannelFacebookPosts', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    vi.spyOn(message, 'success').mockImplementation(() => {})
  })

  it('lists posts by state and retries a postponed one', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([
      { public_id: 'post_1', status: 'published', status_label: 'Đã đăng', published_at: '2026-11-18T03:00:00Z', page_name: 'Fanpage ProCV', permalink: 'https://fb.com/p/1' },
      { public_id: 'post_2', status: 'postponed', status_label: 'Hoãn do chiến dịch tạm dừng', scheduled_for: '2026-11-18T05:00:00Z', page_name: 'Fanpage ProCV' },
    ])
    mocks.rescheduleChannelPost.mockResolvedValue({})
    renderPosts()

    expect(await screen.findByRole('link', { name: 'Xem bài' })).toHaveAttribute('href', 'https://fb.com/p/1')
    await user.click(screen.getByRole('button', { name: 'Đăng lại ngay' }))

    await waitFor(() => expect(mocks.rescheduleChannelPost).toHaveBeenCalledWith('camp_1', 'chn_1', 'post_2', expect.any(String)))
  })

  it('schedules an immediate post on a connected page', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([])
    mocks.getSocialConnections.mockResolvedValue([{ public_id: 'soc_1', page_name: 'Fanpage ProCV', status: 'connected' }])
    mocks.scheduleChannelPost.mockResolvedValue({})
    renderPosts()

    await user.click(await screen.findByRole('button', { name: 'Hẹn đăng' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Fanpage ProCV')
    await user.click(within(dialog).getByRole('button', { name: 'Hẹn đăng' }))

    await waitFor(() => expect(mocks.scheduleChannelPost).toHaveBeenCalledWith('camp_1', 'chn_1', {
      connection: 'soc_1',
      message: 'Tuyển gấp',
      scheduled_for: null,
    }))
  })

  it('points to the integrations page when no page is connected', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([])
    mocks.getSocialConnections.mockResolvedValue([])
    renderPosts()

    await user.click(await screen.findByRole('button', { name: 'Hẹn đăng' }))

    expect(await screen.findByRole('link', { name: /Kết nối Fanpage trong Cài đặt tài khoản/ }))
      .toHaveAttribute('href', '/tuyendung/app/account/settings/integrations')
  })
})
