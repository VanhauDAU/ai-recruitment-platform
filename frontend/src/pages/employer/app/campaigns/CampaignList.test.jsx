import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignList from './CampaignList'

const { getCampaigns, readinessState } = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
  readinessState: { canAccessCandidateData: true },
}))
vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness: () => readinessState,
}))
vi.mock('@/entities/campaign', async (importOriginal) => ({
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
    getCampaigns.mockResolvedValue({ count: 2, results: CAMPAIGNS, status_counts: STATUS_COUNTS })
  })

  it('orders by status by default and filters through the status tabs with counts', async () => {
    renderPage()

    const tabs = await screen.findByRole('navigation', { name: 'Lọc chiến dịch theo trạng thái' })
    await waitFor(() => expect(within(tabs).getByRole('button', { name: /Nháp\s*1/ })).toBeInTheDocument())
    expect(getCampaigns).toHaveBeenCalledWith({ page: 1, ordering: 'status' })
    expect(within(tabs).getByRole('button', { name: /Tất cả\s*3/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(tabs).getByRole('button', { name: /Đã kết thúc\s*1/ }))

    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ page: 1, ordering: 'status', status: 'ended' }))
  })

  it('searches on Enter and sends the query to the API', async () => {
    renderPage()
    const search = screen.getByPlaceholderText(/Tìm theo tên hoặc mã chiến dịch/)

    fireEvent.change(search, { target: { value: ' Frontend ' } })
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(getCampaigns).toHaveBeenLastCalledWith({ page: 1, ordering: 'status', q: 'Frontend' }))
  })

  it('shows one next action per campaign and the derived headcount', async () => {
    renderPage()

    expect((await screen.findAllByText('2 tin, tuyển 4 người')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('01/12/2026 đến 31/12/2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Khi kích hoạt đến tuyển liên tục').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Xem 3 CV mới' })[0])
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_live?active_tab=apply_cv')
    expect(screen.getAllByRole('link', { name: 'Thiết lập' })[0])
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_draft/setup')
    expect(screen.getAllByRole('link', { name: 'Tuyển Frontend' })[0])
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_live')
  })

  it('keeps aggregate counts but hides candidate previews without candidate access', async () => {
    readinessState.canAccessCandidateData = false
    renderPage()

    expect((await screen.findAllByText('3 ứng viên')).length).toBeGreaterThan(0)
    expect(screen.queryByTitle('Nguyễn Minh Anh')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Xem 3 CV mới' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Mở' })[0])
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_live')
  })
})
