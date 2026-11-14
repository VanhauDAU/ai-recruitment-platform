import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPANY_DETAIL_ROUTE, COMPANY_SEARCH_PATH } from '@/entities/company'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/site-settings'
import { DocumentMetadataContext } from '@/shared/config/document-metadata-context'
import CompanyDetail from './CompanyDetail'
import CompanySearch from './CompanySearch'

const { client } = vi.hoisted(() => ({ client: { get: vi.fn() } }))

vi.mock('@/shared/api/client', () => ({ default: client }))
vi.mock('@/widgets/public-company-profile', () => ({
  PublicCompanyProfile: (props) => <output data-testid="company-profile">{JSON.stringify(props)}</output>,
}))

const PROFILE = {
  public_id: 'co_ab12',
  slug: 'fpt-software',
  canonical_path: '/cong-ty/fpt-software',
  indexable: true,
  identity: { display_name: 'FPT Software', logo_url: '/logo.png', cover_image_url: '' },
  stats: { active_public_job_count: 12 },
  sections: [{ key: 'about', type: 'rich_text', body_html: '<p>Chúng tôi làm phần mềm.</p>' }],
  sidebar: [],
}

function renderRoutes(initialEntry, { routes, settings = DEFAULT_SITE_SETTINGS } = {}) {
  const registerMetadata = vi.fn(() => () => {})
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SiteSettingsContext.Provider value={{ settings }}>
        <DocumentMetadataContext.Provider value={registerMetadata}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              {routes || <Route path={COMPANY_DETAIL_ROUTE} element={<CompanyDetail />} />}
            </Routes>
          </MemoryRouter>
        </DocumentMetadataContext.Provider>
      </SiteSettingsContext.Provider>
    </QueryClientProvider>,
  )
  return { lastMetadata: () => registerMetadata.mock.lastCall[0] }
}

describe('CompanyDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.get.mockResolvedValue({ data: PROFILE })
  })

  it('passes the slug and default view to the widget and registers indexable metadata', async () => {
    const { lastMetadata } = renderRoutes('/cong-ty/fpt-software')

    expect(JSON.parse(screen.getByTestId('company-profile').textContent))
      .toEqual({ slug: 'fpt-software', tab: '', q: '', location: '', page: 1 })
    expect(lastMetadata()).toEqual(expect.objectContaining({ title: 'Hồ sơ công ty', robots: 'noindex, nofollow' }))

    await waitFor(() => expect(lastMetadata().title).toBe('FPT Software tuyển dụng'))
    expect(lastMetadata()).toEqual(expect.objectContaining({
      description: 'Chúng tôi làm phần mềm.',
      canonicalPath: '/cong-ty/fpt-software',
      imageUrl: '/logo.png',
      robots: 'index, follow',
    }))
    expect(lastMetadata().structuredData['@type']).toBe('BreadcrumbList')
    expect(client.get).toHaveBeenCalledWith('/companies/fpt-software/', expect.any(Object))
  })

  it('reads tab and filters from the URL and stops indexing that view', async () => {
    const { lastMetadata } = renderRoutes('/cong-ty/fpt-software?tab=viec-lam&q=React&location=1&page=2')

    expect(JSON.parse(screen.getByTestId('company-profile').textContent))
      .toEqual({ slug: 'fpt-software', tab: 'viec-lam', q: 'React', location: '1', page: 2 })
    await waitFor(() => expect(lastMetadata().title).toBe('FPT Software tuyển dụng'))
    expect(lastMetadata().robots).toBe('noindex, nofollow')
    expect(lastMetadata().canonicalPath).toBe('/cong-ty/fpt-software')
  })

  it('honours the site-wide indexing switch', async () => {
    const { lastMetadata } = renderRoutes('/cong-ty/fpt-software', {
      settings: { ...DEFAULT_SITE_SETTINGS, seo_robots_index: false },
    })

    await waitFor(() => expect(lastMetadata().title).toBe('FPT Software tuyển dụng'))
    expect(lastMetadata().robots).toBe('noindex, nofollow')
  })

  it('titles a hidden or unknown company as not found without indexing it', async () => {
    client.get.mockRejectedValue({ response: { status: 404 } })
    const { lastMetadata } = renderRoutes('/cong-ty/da-bi-an')

    await waitFor(() => expect(lastMetadata().title).toBe('Không tìm thấy công ty'))
    expect(lastMetadata().robots).toBe('noindex, nofollow')
  })

  it.each([
    ['search route declared first', [COMPANY_SEARCH_PATH, COMPANY_DETAIL_ROUTE]],
    ['detail route declared first', [COMPANY_DETAIL_ROUTE, COMPANY_SEARCH_PATH]],
  ])('lets /cong-ty/tim-kiem win over the slug route (%s)', (_, order) => {
    const elements = {
      [COMPANY_SEARCH_PATH]: <CompanySearch />,
      [COMPANY_DETAIL_ROUTE]: <CompanyDetail />,
    }
    renderRoutes('/cong-ty/tim-kiem', {
      routes: order.map((path) => <Route key={path} path={path} element={elements[path]} />),
    })

    expect(screen.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
    expect(screen.queryByTestId('company-profile')).not.toBeInTheDocument()
    expect(client.get).not.toHaveBeenCalled()
  })
})
