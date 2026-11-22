import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { getCampaigns, readinessState } = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
  readinessState: { canAccessCandidateData: true },
}))
vi.mock('@/entities/account/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness: () => readinessState,
}))
vi.mock('@/entities/campaign/campaign', async (importOriginal) => ({
  ...await importOriginal(),
  getCampaigns,
}))

const STATUS_COUNTS = { all: 3, active: 1, paused: 0, scheduled: 0, draft: 1, ended: 1 }
const CAMPAIGNS = [
  {
    public_id: 'camp_live',
    name: 'Tuyển Frontend',
    status: 'active',
    start_date: '2026-12-01',
    target_date: '2026-12-31',
    job_count: 2,
    headcount: 4,
    active_job_count: 2,
    candidate_count: 3,
    application_pair_count: 5,
    unviewed_count: 3,
    accepted_count: 1,
    candidate_previews: [{ public_id: 'cand_1', full_name: 'Nguyễn Minh Anh', avatar_url: '' }],
    last_activity: { label: 'Nhận CV ứng tuyển', occurred_at: '2026-12-02T09:00:00Z' },
  },
  {
    public_id: 'camp_draft',
    name: 'Tuyển Marketing',
    status: 'draft',
    is_continuous: true,
    job_count: 0,
    headcount: 0,
    candidate_count: 0,
  },
]

function renderPage(initialEntry = '/tuyendung/app/campaigns') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tuyendung/app/campaigns" element={<CampaignList />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignList', () => {
  beforeEach(() => {
    readinessState.canAccessCandidateData = true
    getCampaigns.mockReset()
    getCampaigns.mockResolvedValue({
      count: 2,
      results: CAMPAIGNS,
      status_counts: STATUS_COUNTS,
      attention_counts: { needs_review: 1, expired_jobs: 0 },
    })
  })

  it('orders by status by default and filters through the status tabs with counts', async () => {
    renderPage()

    const tabs = await screen.findByRole('group', { name: 'Lọc chiến dịch theo trạng thái' })
    await waitFor(() => expect(within(tabs).getByRole('button', { name: /Nháp\s*1/ })).toBeInTheDocument())
    expect(getCampaigns).toHaveBeenCalledWith({ page: 1, ordering: 'status' })
    expect(within(tabs).getByRole('button', { name: /Tất cả\s*3/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(tabs).getByRole('button', { name: /Đã kết thúc\s*1/ }))

    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ page: 1, ordering: 'status', status: 'ended' }))
  })

  it('toggles an attention chip inside the open tab and keeps the order when filters clear', async () => {
    renderPage('/tuyendung/app/campaigns?ordering=name')

    const chips = await screen.findByRole('group', { name: 'Lọc nhanh chiến dịch cần xử lý' })
    expect(await within(chips).findByRole('button', { name: /Có tin hết hạn\s*0/ })).toBeDisabled()
    fireEvent.click(within(chips).getByRole('button', { name: /CV chưa xem\s*1/ }))

    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ page: 1, ordering: 'name', scope: 'needs_review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ page: 1, ordering: 'name' }))
  })

  it('searches on Enter and sends the query to the API', async () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Tìm chiến dịch' })

    fireEvent.change(search, { target: { value: ' Frontend ' } })
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ page: 1, ordering: 'status', q: 'Frontend' }))
  })

  it('shows one next action per campaign, its job states and the hiring progress', async () => {
    renderPage()

    const live = within(await screen.findByTestId('campaign-row-camp_live'))
    const draft = within(screen.getByTestId('campaign-row-camp_draft'))
    expect(live.getByText('2 tin tuyển dụng')).toBeInTheDocument()
    expect(live.getByText('Đang tuyển 2')).toBeInTheDocument()
    expect(live.getByText('Đã tuyển 1/4')).toBeInTheDocument()
    expect(live.getByText('3 mới')).toBeInTheDocument()
    expect(live.getByText('Nhận CV ứng tuyển')).toBeInTheDocument()
    expect(live.getByText('01/12/2026 đến 31/12/2026')).toBeInTheDocument()
    expect(draft.getByText('Khi kích hoạt đến tuyển liên tục')).toBeInTheDocument()
    expect(live.getByRole('link', { name: 'Xem 3 CV mới' }))
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_live?active_tab=apply_cv')
    expect(draft.getByRole('link', { name: 'Thiết lập' }))
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_draft/setup')
    expect(live.getByRole('link', { name: 'Tuyển Frontend' }))
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_live')
  })

  it('keeps aggregate counts but hides candidate previews without candidate access', async () => {
    readinessState.canAccessCandidateData = false
    renderPage()

    const live = within(await screen.findByTestId('campaign-row-camp_live'))
    expect(live.getByText('3 ứng viên')).toBeInTheDocument()
    expect(live.queryByTitle('Nguyễn Minh Anh')).not.toBeInTheDocument()
    expect(live.queryByRole('link', { name: 'Xem 3 CV mới' })).not.toBeInTheDocument()
    expect(live.getByRole('link', { name: 'Mở' }))
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_live')
  })
})
