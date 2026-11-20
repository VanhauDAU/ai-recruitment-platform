import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import ChannelSocialPosts from './ChannelSocialPosts'
import ChannelPostSection from './ChannelPostSection'

const mocks = vi.hoisted(() => ({
  getChannelPosts: vi.fn(),
  getSocialConnections: vi.fn(),
  useSocialNetworks: vi.fn(),
  scheduleChannelPost: vi.fn(),
  cancelChannelPost: vi.fn(),
  rescheduleChannelPost: vi.fn(),
  getChannelPostImageChoices: vi.fn(),
  uploadChannelPostImage: vi.fn(),
  updateCampaignChannel: vi.fn(),
}))
vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))

const channel = {
  public_id: 'chn_1',
  kind: 'facebook_page',
  link: 'http://localhost:5173/r/AbC123xy',
  links: [{ key: 'landing', label: 'Trang tuyển dụng của chiến dịch', url: 'http://localhost:5173/r/AbC123xy' }],
  target: 'landing',
  jobs: [],
  kind_label: 'Fanpage Facebook',
  label: 'Fanpage',
  rendered_content: { headline: 'Tuyển gấp' },
}
const campaign = { public_id: 'camp_1', name: 'Tuyển kỹ thuật', status: 'active' }
const facebook = {
  key: 'facebook_page',
  platform: 'Facebook',
  label: 'Fanpage Facebook',
  channel_kind: 'facebook_page',
  capabilities: { max_chars: 5000, max_images: 4, requires_image: false, supports_delete: true },
  simulated: true,
}
const connected = [{ public_id: 'soc_1', network: 'facebook_page', account_name: 'Fanpage ProCV', status: 'connected' }]

function renderWith(Component) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Component campaign={campaign} channel={channel} network={facebook} editable />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const renderPosts = () => renderWith(ChannelSocialPosts)
const renderComposer = () => renderWith(ChannelPostSection)

describe('ChannelSocialPosts', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getChannelPostImageChoices.mockResolvedValue({ company_images: [] })
    mocks.useSocialNetworks.mockReturnValue({ data: [facebook], isLoading: false })
    mocks.updateCampaignChannel.mockResolvedValue(channel)
    vi.spyOn(message, 'success').mockImplementation(() => {})
  })

  it('lists posts with readable errors and retries a failed one', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([
      { public_id: 'post_1', status: 'published', status_label: 'Đã đăng', published_at: '2026-11-18T03:00:00Z', account_name: 'Fanpage ProCV', permalink: 'https://fb.com/p/1' },
      { public_id: 'post_2', status: 'failed', status_label: 'Đăng không thành công', scheduled_for: '2026-11-18T05:00:00Z', account_name: 'Fanpage ProCV', error_message: 'Facebook không mở được link trong bài.' },
      { public_id: 'post_3', status: 'delete_failed', status_label: 'Cần tự gỡ bài', published_at: '2026-11-17T03:00:00Z', account_name: 'Fanpage ProCV', permalink: 'https://fb.com/p/3' },
    ])
    mocks.rescheduleChannelPost.mockResolvedValue({})
    renderPosts()

    const links = await screen.findAllByRole('link', { name: 'Mở bài trên Facebook' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://fb.com/p/1', 'https://fb.com/p/3'])
    expect(screen.getByText('Facebook không mở được link trong bài.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đăng lại' }))

    await waitFor(() => expect(mocks.rescheduleChannelPost).toHaveBeenCalledWith('camp_1', 'chn_1', 'post_2', expect.any(String)))
  })

  it('posts now on a connected page with a live preview', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([])
    mocks.getSocialConnections.mockResolvedValue(connected)
    mocks.scheduleChannelPost.mockResolvedValue({})
    renderComposer()

    await user.click(await screen.findByRole('button', { name: 'Soạn bài' }))
    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByLabelText('Xem trước bài đăng')).toHaveTextContent('Tuyển gấp')
    expect(within(drawer).getByText(/Facebook sẽ hiện dạng chữ/)).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Đăng ngay' }))

    await waitFor(() => expect(mocks.scheduleChannelPost).toHaveBeenCalledWith('camp_1', 'chn_1', {
      connection: 'soc_1',
      message: 'Tuyển gấp',
      images: [],
      scheduled_for: null,
    }))
  })

  it('attaches the company cover to a post and shows it in the preview', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([])
    mocks.getSocialConnections.mockResolvedValue(connected)
    mocks.getChannelPostImageChoices.mockResolvedValue({
      company_images: [{ kind: 'cover', label: 'Ảnh bìa công ty', path: 'employers/cmp/covers/a.jpg', url: 'http://localhost:8000/media/employers/cmp/covers/a.jpg' }],
    })
    mocks.scheduleChannelPost.mockResolvedValue({})
    renderComposer()

    await user.click(await screen.findByRole('button', { name: 'Soạn bài' }))
    const drawer = await screen.findByRole('dialog')
    await user.click(await within(drawer).findByRole('button', { name: /Dùng ảnh bìa công ty/ }))
    expect(within(drawer).getByRole('img', { name: 'Ảnh 1 của bài' })).toBeInTheDocument()
    expect(within(drawer).queryByText(/Facebook sẽ hiện dạng chữ/)).not.toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Đăng ngay' }))

    await waitFor(() => expect(mocks.scheduleChannelPost).toHaveBeenCalledWith('camp_1', 'chn_1', expect.objectContaining({
      images: ['employers/cmp/covers/a.jpg'],
    })))
  })

  it('schedules a series of posts', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([])
    mocks.getSocialConnections.mockResolvedValue(connected)
    mocks.scheduleChannelPost.mockResolvedValue({})
    renderComposer()

    await user.click(await screen.findByRole('button', { name: 'Soạn bài' }))
    const drawer = await screen.findByRole('dialog')
    await user.click(await within(drawer).findByText('Đăng nhiều lần'))
    await user.click(within(drawer).getByRole('checkbox', { name: '3 ngày' }))
    await user.click(within(drawer).getByRole('button', { name: 'Hẹn 3 bài' }))

    await waitFor(() => expect(mocks.scheduleChannelPost).toHaveBeenCalledTimes(3))
    const times = mocks.scheduleChannelPost.mock.calls.map((call) => call[2].scheduled_for)
    expect(times.every(Boolean)).toBe(true)
  })

  it('points to the integrations page when no page is connected', async () => {
    const user = userEvent.setup()
    mocks.getChannelPosts.mockResolvedValue([])
    mocks.getSocialConnections.mockResolvedValue([])
    renderComposer()

    await user.click(await screen.findByRole('button', { name: 'Soạn bài' }))

    expect(await screen.findByRole('link', { name: 'Cài đặt tài khoản' }))
      .toHaveAttribute('href', '/tuyendung/app/account/settings/integrations')
  })
})
