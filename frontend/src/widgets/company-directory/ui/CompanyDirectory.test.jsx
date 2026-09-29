import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicCompanies } from '@/entities/company'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/site-settings'
import CompanyDirectory from './CompanyDirectory'

vi.mock('@/entities/company', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicCompanies: vi.fn(),
}))

class IntersectionObserverMock {
  static instances = []

  constructor(callback, options) {
    this.callback = callback
    this.options = options
    IntersectionObserverMock.instances.push(this)
  }

  observe = vi.fn()
  disconnect = vi.fn()

  emit(isIntersecting = true) {
    this.callback([{ isIntersecting }])
  }
}

function company(publicId, companyName, overrides = {}) {
  return {
    public_id: publicId,
    slug: publicId,
    company_name: companyName,
    trade_name: '',
    logo_url: '',
    cover_image_url: '',
    description_excerpt: `${companyName} cung cấp môi trường làm việc chuyên nghiệp.`,
    headquarters: 'Hà Nội',
    active_public_job_count: 4,
    company_size_display: '100 - 499 nhân viên',
    industries_detail: [{ id: 1, slug: 'cong-nghe', name: 'Công nghệ' }],
    ...overrides,
  }
}

function renderDirectory(props = {}, { siteName } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const directory = <CompanyDirectory query="" onQueryChange={vi.fn()} {...props} />
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        {siteName
          ? (
              <SiteSettingsContext.Provider value={{
                settings: { ...DEFAULT_SITE_SETTINGS, site_name: siteName },
              }}>
                {directory}
              </SiteSettingsContext.Provider>
            )
          : directory}
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CompanyDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    IntersectionObserverMock.instances = []
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders featured companies as one finite response without an observer or load-more UI', async () => {
    getPublicCompanies.mockResolvedValue({
      next: 'https://api.example.com/api/companies/?cursor=must-not-follow',
      previous: null,
      results: [company('co_featured', 'Công ty Nổi bật')],
    })

    renderDirectory()

    expect(await screen.findByRole('heading', { name: 'Công ty Nổi bật' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Danh sách các công ty nổi bật' })).toBeVisible()
    expect(IntersectionObserverMock.instances).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Tải thêm công ty' })).not.toBeInTheDocument()
    expect(screen.queryByText('Bạn đã xem hết kết quả tìm kiếm.')).not.toBeInTheDocument()
    expect(getPublicCompanies).toHaveBeenCalledOnce()
    expect(getPublicCompanies).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    )
    const heroImage = screen.getByRole('img', {
      name: 'ProCV - Kết nối tài năng - Kiến tạo tương lai',
    })
    expect(heroImage).toHaveAttribute('width', '1024')
    expect(heroImage).toHaveAttribute('height', '479')
    expect(heroImage).toHaveAttribute('loading', 'eager')
    expect(heroImage).toHaveAttribute('fetchpriority', 'high')
    expect(heroImage).toHaveAttribute('decoding', 'async')
    expect(document.querySelector('source[type="image/webp"]'))
      .toHaveAttribute('srcset', '/images/company/company-directory-hero.webp')
  })

  it('renders only the compact search header for a blank search route', () => {
    renderDirectory({ mode: 'search', query: '   ' }, { siteName: 'CareerHub' })

    const searchHeading = screen.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })
    expect(searchHeading).toHaveTextContent('để CareerHub kết nối bạn')
    expect(searchHeading).toHaveClass('text-lg', 'font-bold', 'sm:text-xl', 'lg:text-2xl')
    expect(screen.getByRole('searchbox', { name: 'Tên công ty' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Kết quả tìm kiếm' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('top-employers-sidebar')).not.toBeInTheDocument()
    expect(screen.getByTestId('company-search-status')).toBeEmptyDOMElement()
    expect(screen.queryByTestId('company-directory-hero-visual')).not.toBeInTheDocument()
    const searchIllustration = screen.getByRole('img', {
      name: 'Minh họa kết nối ứng viên với cơ hội việc làm',
    })
    expect(searchIllustration).toHaveAttribute('width', '705')
    expect(searchIllustration).toHaveAttribute('height', '660')
    expect(searchIllustration).toHaveAttribute('loading', 'eager')
    expect(searchIllustration).toHaveAttribute('fetchpriority', 'high')
    expect(searchIllustration).toHaveAttribute('decoding', 'async')
    expect(searchIllustration).toHaveClass('max-h-44', 'max-w-xs')
    expect(document.querySelector('source[srcset="/images/company/company-search-illustration.webp"]'))
      .toHaveAttribute('type', 'image/webp')
    expect(getPublicCompanies).not.toHaveBeenCalled()
    expect(IntersectionObserverMock.instances).toHaveLength(0)
  })

  it('appends the next search cursor page when the sentinel enters the preload margin', async () => {
    getPublicCompanies.mockImplementation((params) => {
      if (!params.q) {
        return Promise.resolve({
          next: null,
          previous: null,
          results: [company('co_featured', 'Nhà tuyển dụng Nổi bật')],
        })
      }
      if (!params.cursor) {
        return Promise.resolve({
          count: 2_083,
          next: 'https://api.example.com/api/companies/?q=Alpha&cursor=page-two',
          previous: null,
          results: [company('co_alpha', 'Công ty Alpha')],
        })
      }
      return Promise.resolve({
        count: 2_083,
        next: null,
        previous: 'https://api.example.com/api/companies/?cursor=page-one',
        results: [company('co_beta', 'Công ty Beta')],
      })
    })

    const { container } = renderDirectory({ query: 'Alpha' })

    expect(await screen.findByRole('heading', { name: 'Công ty Alpha' })).toBeVisible()
    expect(screen.getByRole('heading', {
      name: 'Tìm thấy 2.083 công ty phù hợp với yêu cầu của bạn',
    })).toBeVisible()
    expect(screen.getByText('2.083')).toHaveProperty('tagName', 'SPAN')
    expect(screen.getByText('2.083')).toHaveClass('text-[var(--brand-primary)]')
    expect(screen.queryByText('2.083')?.closest('strong')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tìm thấy 2.083 công ty phù hợp với yêu cầu của bạn.',
    )
    expect(screen.getByTestId('company-search-results'))
      .toHaveClass('rounded-xl', 'p-3')
    expect(screen.getByTestId('company-search-list')).toHaveClass('gap-2.5')
    expect(screen.getByRole('heading', { name: 'Nhà tuyển dụng hàng đầu' })).toBeVisible()
    expect(await screen.findByRole('link', { name: 'Xem việc làm tại Nhà tuyển dụng Nổi bật' }))
      .toBeVisible()
    expect(screen.getByText('Đang tuyển 4 vị trí')).toBeVisible()
    expect(screen.getByText('Hà Nội')).toBeVisible()
    expect(container.querySelector('.company-directory-cover')).not.toBeInTheDocument()
    expect(screen.queryByTestId('company-directory-hero-visual')).not.toBeInTheDocument()
    await waitFor(() => expect(IntersectionObserverMock.instances).toHaveLength(1))
    expect(IntersectionObserverMock.instances[0].options).toEqual({ rootMargin: '700px 0px' })

    await act(async () => IntersectionObserverMock.instances[0].emit())

    expect(await screen.findByRole('heading', { name: 'Công ty Beta' })).toBeVisible()
    expect(getPublicCompanies).toHaveBeenCalledWith(
      { q: 'Alpha', cursor: 'page-two' },
      { signal: expect.any(AbortSignal) },
    )
    expect(screen.getByText('Bạn đã xem hết kết quả tìm kiếm.')).toBeVisible()
  })

  it('submits and clears the URL-owned company query', async () => {
    const user = userEvent.setup()
    const onQueryChange = vi.fn()
    getPublicCompanies.mockImplementation((params) => Promise.resolve(
      params.q
        ? { count: 0, next: null, previous: null, results: [] }
        : {
            next: null,
            previous: null,
            results: [company('co_featured', 'Nhà tuyển dụng Nổi bật')],
          },
    ))

    renderDirectory({ query: 'Alpha', onQueryChange })

    const search = screen.getByRole('searchbox', { name: 'Tên công ty' })
    await user.clear(search)
    await user.type(search, '  Beta  ')
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    expect(onQueryChange).toHaveBeenCalledWith('Beta')

    await user.clear(search)
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    expect(onQueryChange).toHaveBeenLastCalledWith('')
  })

  it('keeps only the search hero when a completed search has zero results', async () => {
    getPublicCompanies.mockImplementation((params) => Promise.resolve(
      params.q
        ? { count: 0, next: null, previous: null, results: [] }
        : {
            next: null,
            previous: null,
            results: [company('co_featured', 'Nhà tuyển dụng Nổi bật')],
          },
    ))

    renderDirectory({ query: 'Không tồn tại' })

    expect(screen.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByTestId('company-search-results')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('top-employers-sidebar')).not.toBeInTheDocument()
    expect(screen.queryByText('Không tìm thấy công ty phù hợp')).not.toBeInTheDocument()
    expect(screen.queryByText(/Chưa có kết quả/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Không tìm thấy công ty phù hợp với yêu cầu của bạn.',
    )
    expect(IntersectionObserverMock.instances).toHaveLength(0)
    expect(getPublicCompanies).toHaveBeenCalledTimes(2)
  })

  it('keeps an explicit retry path when the first request fails', async () => {
    getPublicCompanies.mockRejectedValue(new Error('network down'))
    renderDirectory()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải công ty nổi bật')
    expect(screen.getByRole('button', { name: /Thử lại/ })).toBeVisible()
  })
})
