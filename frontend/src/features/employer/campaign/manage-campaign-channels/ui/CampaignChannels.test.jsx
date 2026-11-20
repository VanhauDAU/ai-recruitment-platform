import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import CampaignChannelBoard from './CampaignChannelBoard'
import ChannelReport from './ChannelReport'

const mocks = vi.hoisted(() => ({
  getCampaignChannels: vi.fn(),
  generateCampaignChannelContent: vi.fn(),
  updateCampaignChannel: vi.fn(),
  getCampaignChannelReport: vi.fn(),
  getCampaignChannelCosts: vi.fn(),
  addCampaignChannelCost: vi.fn(),
  getChannelPosts: vi.fn(),
}))

vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))

const campaign = { public_id: 'camp_1', status: 'active' }
const channel = {
  public_id: 'chn_1',
  kind: 'facebook_group',
  kind_label: 'Nhóm Facebook',
  label: 'Nhóm IT Hà Nội',
  link: 'https://procv.vn/r/AbC123xy',
  links: [
    { key: 'landing', label: 'Trang tuyển dụng của chiến dịch', url: 'https://procv.vn/r/AbC123xy' },
    { key: 'company', label: 'Trang công ty', url: 'https://procv.vn/r/AbC123xy/cong-ty' },
    { key: 'jb_a', label: 'Kỹ sư Backend', url: 'https://procv.vn/r/AbC123xy/jb_a' },
    { key: 'jb_b', label: 'Kế toán', url: 'https://procv.vn/r/AbC123xy/jb_b' },
  ],
  target: 'landing',
  jobs: [],
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

  it('lists channels and opens the selected one with its results, content and link', async () => {
    const user = userEvent.setup()
    mocks.getCampaignChannels.mockResolvedValue([channel, { ...channel, public_id: 'chn_2', kind: 'linkedin', kind_label: 'LinkedIn', label: 'LinkedIn công ty' }])
    mocks.generateCampaignChannelContent.mockResolvedValue({ ...channel, fallback_reason: 'ai_disabled' })
    mocks.updateCampaignChannel.mockResolvedValue(channel)
    renderWithClient(<CampaignChannelBoard campaign={campaign} />)

    const list = await screen.findByRole('navigation', { name: 'Danh sách kênh' })
    expect(within(list).getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Nhóm IT Hà Nội' })).toBeInTheDocument()
    expect(screen.getByText('2.000.000 đ')).toBeInTheDocument()
    expect(screen.getByText('20% người bấm')).toBeInTheDocument()

    expect(screen.getByText(/Chưa có bài/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Soạn bài' }))
    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: /Soạn bằng AI/ }))
    await waitFor(() => expect(mocks.generateCampaignChannelContent).toHaveBeenCalledWith('camp_1', 'chn_1'))
    expect(mocks.updateCampaignChannel).toHaveBeenCalledWith('camp_1', 'chn_1', { jobs: [], target: 'landing' })
    expect(message.info).toHaveBeenCalledWith('AI đang tắt nên dùng mẫu có sẵn. Hãy đọc lại và sửa cho hợp.')
    await user.click(within(drawer).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('tab', { name: 'Link & QR' }))
    expect(await screen.findByText('https://procv.vn/r/AbC123xy')).toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: /LinkedIn công ty/ }))
    expect(await screen.findByRole('heading', { name: 'LinkedIn công ty' })).toBeInTheDocument()
  })

  it('writes a post in one drawer: jobs, link type, an inserted link, then save and copy', async () => {
    const user = userEvent.setup()
    const drafted = { ...channel, content: { body: 'Ứng tuyển {link}' }, rendered_content: { body: 'Ứng tuyển https://procv.vn/r/AbC123xy' } }
    mocks.getCampaignChannels.mockResolvedValue([drafted])
    mocks.updateCampaignChannel.mockResolvedValue(drafted)
    renderWithClient(<CampaignChannelBoard campaign={campaign} />)

    expect(await screen.findByText('Ứng tuyển https://procv.vn/r/AbC123xy')).toBeInTheDocument()
    expect(screen.getByText('Tin mới nhất · Trang chiến dịch')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sửa' }))
    const drawer = await screen.findByRole('dialog')
    const jobs = within(drawer).getByRole('group', { name: 'Tin trong bài' })
    await user.click(within(jobs).getByRole('button', { name: 'Kế toán' }))
    await user.click(within(drawer).getByRole('combobox'))
    await user.click(await screen.findByTitle('Từng tin'))
    expect(within(drawer).getByRole('status')).toHaveTextContent('Soạn lại bằng AI')

    await user.click(within(drawer).getByRole('button', { name: /Chèn link/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Trang công ty' }))
    expect(within(drawer).getByRole('textbox')).toHaveValue('Ứng tuyển https://procv.vn/r/AbC123xy https://procv.vn/r/AbC123xy/cong-ty ')

    await user.click(within(drawer).getByRole('button', { name: /Lưu và sao chép/ }))
    await waitFor(() => expect(mocks.updateCampaignChannel).toHaveBeenCalledWith('camp_1', 'chn_1', {
      jobs: ['jb_b'],
      target: 'job',
      content: { body: 'Ứng tuyển https://procv.vn/r/AbC123xy https://procv.vn/r/AbC123xy/cong-ty ' },
    }))

    await user.click(screen.getByRole('tab', { name: 'Link & QR' }))
    expect(await screen.findByText('https://procv.vn/r/AbC123xy/cong-ty')).toBeInTheDocument()
    expect(screen.getByText('Tin: Kế toán')).toBeInTheDocument()
  })

  it('shows a Fanpage tab as its posts with one compose button', async () => {
    mocks.getCampaignChannels.mockResolvedValue([{ ...channel, kind: 'facebook_page', kind_label: 'Fanpage Facebook', label: 'Fanpage' }])
    mocks.getChannelPosts.mockResolvedValue([])
    renderWithClient(<MemoryRouter><CampaignChannelBoard campaign={campaign} /></MemoryRouter>)

    expect(await screen.findByText('Chưa có bài nào trên Fanpage.')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Bài đăng', 'Link & QR', 'Chi phí'])
    expect(screen.getByRole('button', { name: 'Soạn bài' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Sao chép bài/ })).not.toBeInTheDocument()
  })

  it('marks a manual channel as posted', async () => {
    const user = userEvent.setup()
    mocks.getCampaignChannels.mockResolvedValue([{ ...channel, rendered_content: { body: 'Tuyển gấp' } }])
    mocks.updateCampaignChannel.mockResolvedValue({ ...channel, posted_at: '2026-11-18T10:00:00Z' })
    renderWithClient(<CampaignChannelBoard campaign={campaign} />)

    await user.click(await screen.findByRole('checkbox', { name: 'Tôi đã đăng bài lên kênh này' }))

    await waitFor(() => expect(mocks.updateCampaignChannel).toHaveBeenCalledWith('camp_1', 'chn_1', { posted: true }))
  })

  it('records a cost with a quick pick and explains what costs are for', async () => {
    const user = userEvent.setup()
    mocks.getCampaignChannels.mockResolvedValue([channel])
    mocks.getCampaignChannelCosts.mockResolvedValue([])
    mocks.addCampaignChannelCost.mockResolvedValue({})
    renderWithClient(<CampaignChannelBoard campaign={{ ...campaign, budget_max: 10000000 }} />)

    await user.click(await screen.findByRole('tab', { name: 'Chi phí' }))
    expect(await screen.findByText(/ProCV không thu khoản nào/)).toBeInTheDocument()
    const summary = screen.getByText('Đã chi cho kênh').closest('dl')
    expect(within(summary).getByText('1.000.000 đ')).toBeInTheDocument()
    expect(within(summary).getByText('20%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chạy quảng cáo' }))
    await user.click(screen.getByRole('button', { name: '500.000 đ' }))
    await user.click(screen.getByRole('button', { name: 'Ghi khoản chi' }))

    await waitFor(() => expect(mocks.addCampaignChannelCost).toHaveBeenCalledWith('camp_1', 'chn_1', {
      amount: 500000,
      incurred_on: expect.any(String),
      note: 'Chạy quảng cáo',
    }))
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
