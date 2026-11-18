import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignLanding from './CampaignLanding'

const mocks = vi.hoisted(() => ({ getPublicCampaign: vi.fn(), getJobs: vi.fn() }))
vi.mock('@/entities/campaign', async (importOriginal) => ({ ...(await importOriginal()), getPublicCampaign: mocks.getPublicCampaign }))
vi.mock('@/entities/job', async (importOriginal) => ({ ...(await importOriginal()), getJobs: mocks.getJobs }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ isAuthenticated: false }) }))
vi.mock('@/features/auth', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('./ui/JobCard', () => ({ default: ({ job }) => <p>{job.title}</p> }))

const campaign = {
  public_id: 'camp_1',
  slug: 'tuyen-ky-thuat-camp-1',
  name: 'Tuyển kỹ thuật quý 1',
  intro: 'Đội sản phẩm đang mở rộng.',
  state: 'open',
  is_continuous: false,
  target_date: '2027-01-31',
  company: { public_id: 'cmp_1', name: 'Công ty ProCV', slug: 'procv', logo_url: '', cover_image_url: '' },
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tuyen-dung/tuyen-ky-thuat-camp-1']}>
        <Routes>
          <Route path="/tuyen-dung/:slug" element={<CampaignLanding />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CampaignLanding', () => {
  beforeEach(() => {
    mocks.getPublicCampaign.mockReset()
    mocks.getJobs.mockReset().mockResolvedValue({ count: 1, results: [{ public_id: 'job_1', title: 'Backend Engineer' }] })
  })

  it('lists the campaign jobs while it is open', async () => {
    mocks.getPublicCampaign.mockResolvedValue(campaign)
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Tuyển kỹ thuật quý 1' })).toBeInTheDocument()
    expect(screen.getByText('Nhận hồ sơ đến 31/01/2027')).toBeInTheDocument()
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(mocks.getJobs).toHaveBeenCalledWith({ campaign: 'camp_1' })
  })

  it('points to the company jobs once the campaign has ended', async () => {
    mocks.getPublicCampaign.mockResolvedValue({ ...campaign, state: 'ended' })
    renderPage()

    expect(await screen.findByText(/Đợt tuyển này đã kết thúc/)).toBeInTheDocument()
    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalledWith({ company: 'cmp_1' }))
    expect(screen.getByRole('heading', { name: 'Việc làm khác của Công ty ProCV' })).toBeInTheDocument()
  })

  it('shows not found for an unknown page', async () => {
    mocks.getPublicCampaign.mockRejectedValue({ response: { status: 404 } })
    renderPage()

    expect(await screen.findByText('Không tìm thấy trang tuyển dụng')).toBeInTheDocument()
  })
})
