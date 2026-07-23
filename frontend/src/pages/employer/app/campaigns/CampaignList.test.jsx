import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { changeCampaignStatus, getCampaigns, updateCampaign } = vi.hoisted(() => ({
  changeCampaignStatus: vi.fn(),
  getCampaigns: vi.fn(),
  updateCampaign: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  CAMPAIGN_ORDERING_OPTIONS: [
    { value: 'activity', label: 'Hoạt động gần nhất' },
  ],
  CAMPAIGN_SCOPE_OPTIONS: [
    { value: '', label: 'Tất cả nhu cầu xử lý' },
    { value: 'needs_review', label: 'Có CV ứng tuyển mới cần xem' },
  ],
  CAMPAIGN_STATUS_COLORS: { active: 'green', paused: 'orange' },
  CAMPAIGN_STATUS_LABELS: { active: 'Đang mở', paused: 'Đang tắt' },
  CAMPAIGN_STATUS_OPTIONS: [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'active', label: 'Đang hoạt động' },
  ],
  campaignKeys: { all: ['campaigns'], list: (params = {}) => ['campaigns', 'list', params] },
  changeCampaignStatus,
  createCampaign: vi.fn(),
  getCampaigns,
  updateCampaign,
}))
vi.mock('@/features/manage-campaigns', () => ({
  CampaignNameForm: ({ initialName }) => <p>Sửa chiến dịch {initialName}</p>,
  CampaignLifecycleActions: ({ campaign, variant }) => variant === 'switch'
    ? (
        <button
          type="button"
          role="switch"
          aria-checked={campaign.status === 'active'}
          aria-label={`Dừng chiến dịch ${campaign.name}`}
        />
      )
    : <button type="button">Dừng</button>,
}))

function CampaignDetailRoute() {
  const location = useLocation()
  return <p data-testid="campaign-detail-location">{location.search}</p>
}

function renderPage(initialEntry = '/tuyendung/app/campaigns') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tuyendung/app/campaigns" element={<CampaignList />} />
          <Route path="/tuyendung/app/campaigns/:publicId" element={<CampaignDetailRoute />} />
          <Route path="/tuyendung/app/jobs/new" element={<p>New job page</p>} />
          <Route path="/tuyendung/app/jobs/:publicId" element={<p>Job detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignList', () => {
  beforeEach(() => {
    changeCampaignStatus.mockReset()
    getCampaigns.mockReset()
    getCampaigns.mockResolvedValue({ count: 0, results: [] })
  })

  it('searches on Enter and sends the query to the API', async () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Tìm chiến dịch (Nhấn Enter để tìm kiếm)'), {
      target: { value: 'Frontend' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Tìm chiến dịch (Nhấn Enter để tìm kiếm)'), {
      key: 'Enter',
      code: 'Enter',
    })

    expect(await screen.findByDisplayValue('Frontend')).toBeInTheDocument()
    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({
      ordering: 'activity',
      page: 1,
      q: 'Frontend',
    }))
  })

  it('links the campaign name to its detail page and shows aggregate campaign counts', async () => {
    getCampaigns.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'camp_frontend',
        name: 'Tuyển Frontend',
        status: 'active',
        candidate_count: 7,
        candidate_previews: [
          { public_id: 'candidate_1', full_name: 'Nguyễn Minh Anh' },
          { public_id: 'candidate_2', full_name: 'Trần Hải Nam' },
          { public_id: 'candidate_3', full_name: 'Lê Thu Hà' },
          { public_id: 'candidate_4', full_name: 'Phạm Quốc Bảo' },
          { public_id: 'candidate_5', full_name: 'Đặng Ngọc Mai' },
        ],
        application_count: 3,
        application_pair_count: 2,
        job_count: 2,
        active_job_count: 1,
        pending_job_count: 1,
        unviewed_application_count: 1,
        last_activity: {
          label: 'Nhận CV ứng tuyển',
          occurred_at: '2026-07-22T09:00:00Z',
        },
        updated_at: '2026-07-22T09:00:00Z',
      }],
    })
    renderPage()

    await screen.findAllByRole('link', { name: 'Tuyển Frontend' })
    expect(screen.getAllByText('#camp_frontend').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Đang tuyển 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chờ duyệt 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2 hồ sơ ứng tuyển').length).toBeGreaterThan(0)
    expect(screen.queryByText('7 ứng viên')).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Nguyễn Minh Anh').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+2').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Đăng thêm tin/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('columnheader', { name: 'Thao tác' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('switch', {
      name: 'Dừng chiến dịch Tuyển Frontend',
    })).not.toHaveLength(0)

    fireEvent.click(screen.getAllByRole('link', { name: 'Tuyển Frontend' })[0])
    expect(await screen.findByTestId('campaign-detail-location')).toHaveTextContent('')
  })

  it('does not render a report button in the jobs column', async () => {
    getCampaigns.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'camp_frontend',
        name: 'Tuyển Frontend',
        status: 'active',
        application_count: 3,
        job_count: 2,
        active_job_count: 1,
        pending_job_count: 1,
        unviewed_application_count: 1,
        updated_at: '2026-07-22T09:00:00Z',
      }],
    })
    renderPage()

    await screen.findAllByRole('link', { name: 'Tuyển Frontend' })
    expect(screen.queryByText('Xem báo cáo')).not.toBeInTheDocument()
  })

  it('makes the paused state explicit in the jobs column', async () => {
    getCampaigns.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'camp_paused',
        name: 'Tuyển Backend',
        status: 'paused',
        job_count: 2,
        active_job_count: 1,
      }],
    })
    renderPage()

    expect((await screen.findAllByText('Chiến dịch đang tắt')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Tổng tin tuyển dụng')).not.toBeInTheDocument()
    expect(screen.queryByText('Đang tuyển 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Đăng thêm tin')).not.toBeInTheDocument()
  })
})
