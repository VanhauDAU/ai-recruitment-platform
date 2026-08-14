import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicCompanies } from '@/entities/company'
import CompanyList from './CompanyList'
import CompanySearch from './CompanySearch'

vi.mock('@/entities/company', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicCompanies: vi.fn(),
}))

function response(publicId, companyName, overrides = {}) {
  return {
    count: publicId ? 1 : 0,
    next: null,
    previous: null,
    results: publicId ? [{
      public_id: publicId,
      company_name: companyName,
      trade_name: '',
      logo_url: '',
      cover_image_url: '',
      description_excerpt: `${companyName} là môi trường làm việc chuyên nghiệp.`,
      headquarters: 'Hà Nội',
      active_public_job_count: 3,
      industries_detail: [],
      ...overrides,
    }] : [],
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function FeaturedRouteProbe() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/cong-ty')}>Mở featured</button>
}

function renderRoutes(initialEntry = '/cong-ty') {
  const client = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/cong-ty" element={<CompanyList />} />
          <Route path="/cong-ty/tim-kiem" element={<CompanySearch />} />
        </Routes>
        <LocationProbe />
        <FeaturedRouteProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('public company routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reuses featured in search, clears to input-only, then fetches a new shuffle on a fresh featured mount', async () => {
    let featuredRequestCount = 0
    let resolveRefreshedFeatured
    getPublicCompanies.mockImplementation((params) => {
      if (params.q) return Promise.resolve(response('search_beta', 'Kết quả Beta'))
      featuredRequestCount += 1
      if (featuredRequestCount === 1) {
        return Promise.resolve(response('featured_old', 'Công ty nổi bật cũ'))
      }
      return new Promise((resolve) => {
        resolveRefreshedFeatured = resolve
      })
    })

    const user = userEvent.setup()
    renderRoutes()

    expect(await screen.findByRole('heading', { name: 'Công ty nổi bật cũ' })).toBeVisible()
    const featuredSearch = screen.getByRole('searchbox', { name: 'Tên công ty' })
    await user.type(featuredSearch, 'Beta')
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))

    expect(await screen.findByRole('heading', { name: 'Kết quả Beta' })).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/cong-ty/tim-kiem?keyword=Beta',
    )
    expect(screen.getByRole('link', { name: 'Xem việc làm tại Công ty nổi bật cũ' }))
      .toBeVisible()
    expect(featuredRequestCount).toBe(1)

    const search = screen.getByRole('searchbox', { name: 'Tên công ty' })
    await user.clear(search)
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty/tim-kiem')
    expect(screen.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
    expect(screen.queryByTestId('company-search-results')).not.toBeInTheDocument()
    expect(screen.queryByTestId('top-employers-sidebar')).not.toBeInTheDocument()
    expect(featuredRequestCount).toBe(1)
    expect(getPublicCompanies).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Mở featured' }))
    await waitFor(() => expect(featuredRequestCount).toBe(2))
    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty')
    expect(screen.queryByRole('heading', { name: 'Công ty nổi bật cũ' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Đang tải công ty nổi bật')).toBeVisible()

    await act(async () => resolveRefreshedFeatured(
      response('featured_new', 'Công ty nổi bật mới'),
    ))
    expect(await screen.findByRole('heading', { name: 'Công ty nổi bật mới' })).toBeVisible()
  })

  it('fetches search results and featured sidebar in parallel on direct search navigation', async () => {
    getPublicCompanies.mockImplementation((params) => Promise.resolve(
      params.q
        ? response('search_alpha', 'Kết quả Alpha')
        : response('featured_alpha', 'Nhà tuyển dụng Alpha'),
    ))

    renderRoutes('/cong-ty/tim-kiem?keyword=Alpha')

    expect(await screen.findByRole('heading', { name: 'Kết quả Alpha' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem việc làm tại Nhà tuyển dụng Alpha' }))
      .toBeVisible()
    expect(getPublicCompanies).toHaveBeenCalledTimes(2)
    expect(getPublicCompanies).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    )
    expect(getPublicCompanies).toHaveBeenCalledWith(
      { q: 'Alpha' },
      { signal: expect.any(AbortSignal) },
    )
    expect(screen.queryByTestId('company-directory-hero-visual')).not.toBeInTheDocument()
  })

  it('submits a blank featured form to the input-only search route', async () => {
    getPublicCompanies.mockImplementation((params) => Promise.resolve(
      params.q
        ? response('search_beta', 'Kết quả Beta')
        : response('featured_one', 'Công ty nổi bật'),
    ))
    const user = userEvent.setup()

    renderRoutes()
    expect(await screen.findByRole('heading', { name: 'Công ty nổi bật' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty/tim-kiem')
    expect(screen.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
    expect(screen.queryByTestId('company-search-results')).not.toBeInTheDocument()
    expect(getPublicCompanies).toHaveBeenCalledOnce()

    const search = screen.getByRole('searchbox', { name: 'Tên công ty' })
    await user.type(search, 'Beta')
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))

    expect(await screen.findByRole('heading', { name: 'Kết quả Beta' })).toBeVisible()
    expect(getPublicCompanies).toHaveBeenCalledTimes(2)
    expect(getPublicCompanies).toHaveBeenCalledWith(
      { q: 'Beta' },
      { signal: expect.any(AbortSignal) },
    )
  })

  it('keeps a blank keyword on the input-only search route without any company request', async () => {
    renderRoutes('/cong-ty/tim-kiem?keyword=%20%20')

    expect(screen.getByTestId('location')).toHaveTextContent('/cong-ty/tim-kiem?keyword=%20%20')
    expect(screen.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
    expect(screen.queryByTestId('company-search-results')).not.toBeInTheDocument()
    expect(screen.queryByTestId('top-employers-sidebar')).not.toBeInTheDocument()
    expect(getPublicCompanies).not.toHaveBeenCalled()
  })
})
