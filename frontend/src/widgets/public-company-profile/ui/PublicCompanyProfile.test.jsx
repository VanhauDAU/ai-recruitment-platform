import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCompanyDetailQuery } from '@/entities/company'
import PublicCompanyProfile from './PublicCompanyProfile'

const { client, promptLogin, session, toggleSaved } = vi.hoisted(() => ({
  client: { get: vi.fn() },
  promptLogin: vi.fn(),
  session: { current: { isAuthenticated: false, user: null } },
  toggleSaved: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: client }))
vi.mock('@/entities/session', () => ({ useSession: () => session.current }))
vi.mock('@/features/auth', () => ({ useLoginPrompt: () => ({ promptLogin }) }))
vi.mock('@/features/saved-jobs', () => ({ useSavedJob: () => [false, toggleSaved, false] }))
vi.mock('@/features/track-job-engagement', () => ({
  JobImpressionBoundary: ({ as: Component = 'div', slug, ...props }) => <Component data-job-slug={slug} {...props} />,
}))

const PROFILE = {
  public_id: 'co_ab12',
  slug: 'fpt-software',
  canonical_path: '/cong-ty/fpt-software',
  indexable: true,
  identity: {
    display_name: 'FPT Software',
    legal_name: 'Công ty TNHH Phần mềm FPT',
    logo_url: '',
    cover_image_url: '',
    website_url: 'https://fpt-software.com',
    industries: [{ id: 1, name: 'Công nghệ thông tin', slug: 'cong-nghe-thong-tin', is_primary: true }],
  },
  stats: { active_public_job_count: 7, company_size: '100-499', company_size_display: '100 - 499 nhân viên', founded_year: 2010 },
  theme: { accent: { key: 'brand', primary: '#00b14f', hover: '#008a3e', soft: '#f0fbf5' } },
  sections: [
    { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p>Chúng tôi làm phần mềm.</p>' },
    { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
  ],
  sidebar: [
    { key: 'general_info', type: 'facts', title: 'Thông tin chung', items: [{ key: 'company_size', label: 'Quy mô', value: '100 - 499 nhân viên' }] },
    { key: 'share', type: 'share', title: 'Chia sẻ công ty' },
    { key: 'similar_companies', type: 'similar_companies', title: 'Công ty cùng lĩnh vực' },
  ],
}

function job(index) {
  return {
    public_id: `job_${index}`,
    slug: `ky-su-phan-mem-${index}`,
    title: `Kỹ sư phần mềm ${index}`,
    company_name: 'Công ty TNHH Phần mềm FPT',
    company_slug: 'fpt-software',
    salary_type: 'range',
    salary_min: 20_000_000,
    salary_max: 30_000_000,
    experience_years: '',
    locations_detail: [{ id: 1, name: 'Hà Nội' }],
    created_at: new Date().toISOString(),
  }
}

function jobsPage(total, shown = Math.min(total, 10)) {
  return { count: total, results: Array.from({ length: shown }, (_, index) => job(index + 1)) }
}

function mockApi({ profile = PROFILE, profileErrors = [], jobs = jobsPage(7), similar = [], locations = [] } = {}) {
  const pendingErrors = [...profileErrors]
  client.get.mockImplementation((url, config) => {
    if (url === `/companies/${profile.slug}/`) {
      return pendingErrors.length ? Promise.reject(pendingErrors.shift()) : Promise.resolve({ data: profile })
    }
    if (url === `/companies/${profile.public_id}/similar/`) return Promise.resolve({ data: { results: similar } })
    if (url === `/companies/${profile.public_id}/job-facets/`) return Promise.resolve({ data: { locations } })
    if (url === '/jobs/') return Promise.resolve({ data: typeof jobs === 'function' ? jobs(config.params) : jobs })
    return Promise.reject(new Error(`Unexpected GET ${url}`))
  })
}

function requests(url) {
  return client.get.mock.calls.filter(([calledUrl]) => calledUrl === url)
}

// Thay cho page: đọc slug và query rồi truyền trạng thái URL đã chuẩn hoá vào widget.
function RouteHarness() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  return (
    <>
      <PublicCompanyProfile slug={slug} {...parseCompanyDetailQuery(searchParams)} />
      <output data-testid="location">{location.pathname}{location.search}</output>
    </>
  )
}

function renderProfile(initialEntry = '/cong-ty/fpt-software') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/cong-ty/:slug" element={<RouteHarness />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicCompanyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.current = { isAuthenticated: false, user: null }
    document.body.className = ''
  })

  it('shows a layout skeleton, then the overview with the first five jobs and similar companies', async () => {
    mockApi({
      similar: [{
        public_id: 'co_other',
        slug: 'cmc-global',
        company_name: 'Công ty CMC Global',
        trade_name: 'CMC Global',
        logo_url: '',
        active_public_job_count: 3,
      }],
    })
    renderProfile()

    expect(screen.getByLabelText('Đang tải trang công ty')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'FPT Software' })).toBeVisible()

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'Công ty' })).toHaveAttribute('href', '/cong-ty')
    const tabs = screen.getByRole('navigation', { name: 'Nội dung trang công ty' })
    expect(within(tabs).getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'Việc làm (7)' })).toHaveAttribute('href', '/cong-ty/fpt-software?tab=viec-lam')
    expect(within(tabs).getByRole('link', { name: 'Việc làm (7)' })).not.toHaveAttribute('aria-current')

    const jobs = screen.getByRole('region', { name: 'Việc làm đang tuyển' })
    expect(await within(jobs).findAllByRole('article')).toHaveLength(5)
    const firstJob = within(jobs).getAllByRole('article')[0]
    expect(within(firstJob).getByRole('link', { name: 'Kỹ sư phần mềm 1' })).toHaveAttribute('href', '/viec-lam/ky-su-phan-mem-1')
    expect(within(firstJob).getByText('20 - 30 triệu')).toBeVisible()
    expect(within(firstJob).getByText('Hà Nội')).toBeVisible()
    expect(within(firstJob).getByText('Đăng hôm nay')).toBeVisible()
    expect(within(firstJob).getByRole('button', { name: 'Lưu việc làm Kỹ sư phần mềm 1' })).toBeVisible()
    expect(within(firstJob).queryByText(/Phần mềm FPT/)).not.toBeInTheDocument()
    expect(firstJob).toHaveAttribute('data-job-slug', 'ky-su-phan-mem-1')
    expect(within(jobs).getByRole('link', { name: 'Xem tất cả việc làm' })).toHaveAttribute('href', '/cong-ty/fpt-software?tab=viec-lam')
    expect(requests('/jobs/')).toEqual([['/jobs/', { params: { company: 'co_ab12', page: 1, page_size: 10 } }]])
    expect(requests('/companies/co_ab12/job-facets/')).toHaveLength(0)

    const similar = screen.getByRole('region', { name: 'Công ty cùng lĩnh vực' })
    expect(await within(similar).findByRole('link', { name: /CMC Global/ })).toHaveAttribute('href', '/cong-ty/cmc-global')
    expect(within(similar).getByText('3 việc làm đang tuyển')).toBeVisible()

    expect(screen.getAllByRole('link', { name: 'Xem việc làm (7)' })[0]).toHaveAttribute('href', '/cong-ty/fpt-software?tab=viec-lam')
    expect(document.body).toHaveClass('has-bottom-action-bar')
  })

  it('keeps a sparse company complete and drops blocks that turn out empty', async () => {
    const sparse = {
      ...PROFILE,
      identity: { ...PROFILE.identity, legal_name: '', website_url: '' },
      stats: { active_public_job_count: 0, company_size: '', company_size_display: '', founded_year: null },
      sections: [{ key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' }],
    }
    mockApi({ profile: sparse, jobs: jobsPage(0) })
    const { container } = renderProfile()

    expect(await screen.findByRole('heading', { level: 1, name: 'FPT Software' })).toBeVisible()
    expect(container.querySelector('.company-profile-cover')).toHaveClass('company-profile-cover--fallback')
    expect(await screen.findByText('Công ty chưa có việc làm đang tuyển.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Thông tin chung' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Chia sẻ công ty' })).toBeVisible()
    await waitFor(() => expect(requests('/companies/co_ab12/similar/')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Công ty cùng lĩnh vực' })).not.toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /Xem việc làm/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Việc làm (0)' })).toBeVisible()
    expect(document.body).not.toHaveClass('has-bottom-action-bar')
  })

  it('renders a real not-found state for an unknown or hidden company without retrying', async () => {
    mockApi({ profileErrors: [{ response: { status: 404 } }] })
    renderProfile()

    expect(await screen.findByText('Không tìm thấy công ty')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem danh sách công ty' })).toHaveAttribute('href', '/cong-ty')
    expect(requests('/companies/fpt-software/')).toHaveLength(1)
    expect(requests('/jobs/')).toHaveLength(0)
  })

  it('offers a retry when the profile request fails for another reason', async () => {
    const user = userEvent.setup()
    mockApi({ profileErrors: [{ response: { status: 500 } }, { response: { status: 500 } }] })
    renderProfile()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải trang công ty')
    expect(screen.queryByText('Không tìm thấy công ty')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'FPT Software' })).toBeVisible()
  })

  it('drives the jobs tab from the URL: keyword, location and page', async () => {
    const user = userEvent.setup()
    mockApi({
      jobs: (params) => (params.search === 'khong-co' ? jobsPage(0) : jobsPage(25)),
      locations: [{ id: 1, name: 'Hà Nội', count: 7 }, { id: 2, name: 'Đà Nẵng', count: 2 }],
    })
    renderProfile('/cong-ty/fpt-software?tab=viec-lam&q=react&location=1&page=2')

    const jobs = await screen.findByRole('region', { name: 'Việc làm đang tuyển' })
    expect(await within(jobs).findAllByRole('article')).toHaveLength(10)
    expect(requests('/jobs/')).toEqual([[
      '/jobs/',
      { params: { company: 'co_ab12', page: 2, page_size: 10, search: 'react', location: '1' } },
    ]])
    expect(within(jobs).getByRole('status')).toHaveTextContent('Tìm thấy 25 việc làm phù hợp')
    expect(screen.queryByRole('heading', { name: 'Giới thiệu công ty' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Thông tin chung' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Việc làm (7)' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: /Xem việc làm/ })).not.toBeInTheDocument()

    const keyword = within(jobs).getByRole('searchbox', { name: 'Tên việc làm' })
    const location = within(jobs).getByRole('combobox', { name: 'Địa điểm' })
    expect(keyword).toHaveValue('react')
    expect(await within(location).findByRole('option', { name: 'Hà Nội (7)' })).toBeInTheDocument()
    expect(location).toHaveValue('1')

    await user.click(within(jobs).getByTitle('3'))
    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty/fpt-software?tab=viec-lam&q=react&location=1&page=3')

    await user.clear(keyword)
    await user.type(keyword, ' node ')
    await user.click(within(jobs).getByRole('button', { name: 'Tìm kiếm' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty/fpt-software?tab=viec-lam&q=node&location=1')
    await waitFor(() => expect(client.get).toHaveBeenCalledWith(
      '/jobs/',
      { params: { company: 'co_ab12', page: 1, page_size: 10, search: 'node', location: '1' } },
    ))

    await user.selectOptions(location, '2')
    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty/fpt-software?tab=viec-lam&q=node&location=2')

    await user.clear(keyword)
    await user.type(keyword, 'khong-co{Enter}')
    expect(await within(jobs).findByText(/Không có việc làm khớp bộ lọc/)).toBeVisible()
    expect(within(jobs).getByRole('link', { name: 'Xoá bộ lọc' })).toHaveAttribute('href', '/cong-ty/fpt-software?tab=viec-lam')
  })

  it('asks guests to sign in before saving and lets candidates toggle the job', async () => {
    const user = userEvent.setup()
    mockApi()
    const { unmount } = renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Lưu việc làm Kỹ sư phần mềm 1' }))
    expect(promptLogin).toHaveBeenCalledOnce()
    expect(toggleSaved).not.toHaveBeenCalled()
    unmount()

    session.current = { isAuthenticated: true, user: { role: 'candidate' } }
    renderProfile()
    await user.click(await screen.findByRole('button', { name: 'Lưu việc làm Kỹ sư phần mềm 1' }))
    expect(toggleSaved).toHaveBeenCalledOnce()
  })
})
