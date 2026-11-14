import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FollowedCompanyList from './FollowedCompanyList'

const { api } = vi.hoisted(() => ({
  api: {
    getFollowedCompanies: vi.fn(),
    getCompanyFollow: vi.fn(),
    followCompany: vi.fn(),
    unfollowCompany: vi.fn(),
  },
}))

vi.mock('../api/follow-company.api', () => api)
vi.mock('@/entities/session', () => ({ useCandidateAudience: () => 'candidate' }))
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn() } }))

function company(index, overrides = {}) {
  return {
    public_id: `co_${index}`,
    slug: `cong-ty-${index}`,
    company_name: `Công ty TNHH Số ${index}`,
    trade_name: `Công ty ${index}`,
    logo_url: '',
    active_public_job_count: index,
    followed_at: '2026-11-10T08:00:00Z',
    notify_new_jobs: true,
    ...overrides,
  }
}

function page(companies, count = companies.length) {
  return { count, next: null, previous: null, results: companies }
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FollowedCompanyList />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FollowedCompanyList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getFollowedCompanies.mockResolvedValue(page([company(1), company(2, { notify_new_jobs: false, active_public_job_count: 0 })]))
  })

  it('shows a skeleton, then each followed company with its page link and controls', async () => {
    renderList()

    expect(screen.getByLabelText('Đang tải công ty đang theo dõi')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('2 công ty đang theo dõi')
    expect(api.getFollowedCompanies).toHaveBeenCalledWith({ page: 1, page_size: 10 }, { signal: expect.anything() })

    const [first, second] = screen.getAllByRole('listitem')
    expect(within(first).getByRole('link', { name: 'Công ty 1' })).toHaveAttribute('href', '/cong-ty/cong-ty-1')
    expect(within(first).getByText(/1 việc làm đang tuyển · Theo dõi từ/)).toBeVisible()
    expect(within(first).getByRole('switch', { name: 'Nhận email việc làm mới từ Công ty 1' })).toBeChecked()
    expect(within(second).getByText(/Chưa có việc làm đang tuyển/)).toBeVisible()
    expect(within(second).getByRole('switch', { name: 'Nhận email việc làm mới từ Công ty 2' })).not.toBeChecked()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(api.getCompanyFollow).not.toHaveBeenCalled()
  })

  it('points an empty list to the company directory', async () => {
    api.getFollowedCompanies.mockResolvedValue(page([]))
    renderList()

    expect(await screen.findByText('Bạn chưa theo dõi công ty nào')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Khám phá công ty' })).toHaveAttribute('href', '/cong-ty')
  })

  it('offers a retry when the list cannot be loaded', async () => {
    const user = userEvent.setup()
    api.getFollowedCompanies.mockRejectedValueOnce({ response: { status: 500 } })
    renderList()

    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa thể tải danh sách công ty đang theo dõi.')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('link', { name: 'Công ty 1' })).toBeVisible()
  })

  it('switches the new-job email of one company', async () => {
    const user = userEvent.setup()
    api.followCompany.mockResolvedValue({ following: true, notify_new_jobs: false, follower_count: 4 })
    renderList()

    const notify = await screen.findByRole('switch', { name: 'Nhận email việc làm mới từ Công ty 1' })
    api.getFollowedCompanies.mockResolvedValue(page([company(1, { notify_new_jobs: false }), company(2)]))
    await user.click(notify)

    await waitFor(() => expect(notify).not.toBeChecked())
    expect(api.followCompany).toHaveBeenCalledWith('co_1', { notify_new_jobs: false })
    expect(screen.getByRole('link', { name: 'Công ty 1' })).toBeVisible()
  })

  it('removes a company as soon as it is unfollowed and reloads the list', async () => {
    const user = userEvent.setup()
    api.unfollowCompany.mockResolvedValue({ following: false, notify_new_jobs: false, follower_count: 3 })
    renderList()

    const unfollow = await screen.findByRole('button', { name: 'Bỏ theo dõi Công ty 1' })
    api.getFollowedCompanies.mockResolvedValue(page([company(2)]))
    await user.click(unfollow)

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Công ty 1' })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Công ty 2' })).toBeVisible()
    expect(api.unfollowCompany).toHaveBeenCalledWith('co_1')
    await waitFor(() => expect(api.getFollowedCompanies).toHaveBeenCalledTimes(2))
  })

  it('pages through the list and steps back when the last page empties', async () => {
    const user = userEvent.setup()
    const firstPage = Array.from({ length: 10 }, (_, index) => company(index + 1))
    let total = 11
    // Như máy chủ: trang nằm ngoài danh sách trả 404.
    api.getFollowedCompanies.mockImplementation(({ page: requested }) => {
      if (requested === 1) return Promise.resolve(page(firstPage, total))
      return total > 10 ? Promise.resolve(page([company(11)], total)) : Promise.reject({ response: { status: 404 } })
    })
    api.unfollowCompany.mockImplementation(() => {
      total = 10
      return Promise.resolve({ following: false, notify_new_jobs: false, follower_count: 0 })
    })
    renderList()

    expect(await screen.findByRole('status')).toHaveTextContent('11 công ty đang theo dõi')
    const pager = screen.getByRole('navigation', { name: 'Phân trang công ty đang theo dõi' })
    expect(within(pager).getByText('Trang 1 / 2')).toBeVisible()
    expect(within(pager).getByRole('button', { name: 'Trang trước' })).toBeDisabled()
    await user.click(within(pager).getByRole('button', { name: 'Trang sau' }))
    await user.click(await screen.findByRole('button', { name: 'Bỏ theo dõi Công ty 11' }))

    expect(await screen.findByRole('link', { name: 'Công ty 1' })).toBeVisible()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('10 công ty đang theo dõi'))
    expect(api.getFollowedCompanies).toHaveBeenLastCalledWith({ page: 1, page_size: 10 }, { signal: expect.anything() })
  })
})
