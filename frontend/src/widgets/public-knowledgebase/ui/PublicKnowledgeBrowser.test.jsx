import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/site-settings'
import { DocumentMetadataContext } from '@/shared/config/document-metadata-context'
import PublicKnowledgeBrowser from './PublicKnowledgeBrowser'

const { getPublicKnowledgeArticles, getPublicKnowledgeCategories } = vi.hoisted(() => ({
  getPublicKnowledgeArticles: vi.fn(),
  getPublicKnowledgeCategories: vi.fn(),
}))

vi.mock('@/entities/knowledgebase', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicKnowledgeArticles,
  getPublicKnowledgeCategories,
}))

const categories = [
  {
    public_id: 'kbc_account',
    name: 'Tài khoản và đăng nhập',
    slug: 'tai-khoan-va-dang-nhap',
    description: 'Quản lý tài khoản.',
    order: 1,
    article_count: 1,
  },
  {
    public_id: 'kbc_security',
    name: 'Bảo mật và quyền riêng tư',
    slug: 'bao-mat-va-quyen-rieng',
    description: 'Giữ tài khoản an toàn.',
    order: 2,
    article_count: 1,
  },
]

const article = {
  public_id: 'kba_login',
  category: {
    public_id: 'kbc_account',
    name: 'Tài khoản và đăng nhập',
    slug: 'tai-khoan-va-dang-nhap',
  },
  slug: 'dang-nhap-an-toan',
  article_type: 'FAQ',
  title: 'Làm thế nào để đăng nhập an toàn?',
  excerpt: 'Nhập email và mật khẩu của bạn.',
  order: 1,
  updated_at: '2026-08-05T08:00:00Z',
}

const securityArticle = {
  public_id: 'kba_privacy',
  category: {
    public_id: 'kbc_security',
    name: 'Bảo mật và quyền riêng tư',
    slug: 'bao-mat-va-quyen-rieng',
  },
  slug: 'bao-ve-du-lieu-ca-nhan',
  article_type: 'FAQ',
  title: 'Dữ liệu cá nhân được bảo vệ thế nào?',
  excerpt: 'Kiểm soát quyền riêng tư và phiên đăng nhập của bạn.',
  order: 1,
  updated_at: '2026-08-05T08:00:00Z',
}

function fold(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
}

function renderBrowser({ entry = '/tro-giup', categorySlug, metadata } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SiteSettingsContext.Provider value={{
        settings: {
          ...DEFAULT_SITE_SETTINGS,
          knowledgebase_public_enabled: true,
          knowledgebase_search_index_enabled: true,
          seo_robots_index: true,
        },
      }}>
        <DocumentMetadataContext.Provider value={metadata || null}>
          <MemoryRouter initialEntries={[entry]}>
            <PublicKnowledgeBrowser categorySlug={categorySlug} />
          </MemoryRouter>
        </DocumentMetadataContext.Provider>
      </SiteSettingsContext.Provider>
    </QueryClientProvider>,
  )
}

describe('PublicKnowledgeBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicKnowledgeCategories.mockResolvedValue(categories)
    getPublicKnowledgeArticles.mockImplementation(async (params = {}) => {
      let results = [article, securityArticle]
      if (params.category) {
        results = results.filter((item) => item.category.slug === params.category)
      }
      if (params.q) {
        const query = fold(params.q)
        results = results.filter((item) => fold(`${item.title} ${item.excerpt}`).includes(query))
      }
      return {
        count: results.length,
        next: null,
        previous: null,
        results,
      }
    })
  })

  it('renders one h1, accessible navigation and published help content', async () => {
    const { container } = renderBrowser()

    expect(await screen.findByRole('heading', { level: 1, name: 'Câu hỏi thường gặp' })).toBeInTheDocument()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm trong tất cả chuyên mục' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Chuyên mục trợ giúp' })).toBeInTheDocument()
    expect(screen.queryByText('Tất cả chủ đề')).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Làm thế nào để đăng nhập an toàn/ })).toHaveAttribute(
      'href',
      '/tro-giup/tai-khoan-va-dang-nhap/dang-nhap-an-toan',
    )
  })

  it('searches every category, labels results and ignores legacy URL search parameters', async () => {
    const { container } = renderBrowser({
      entry: '/tro-giup/tai-khoan-va-dang-nhap?type=faq&q=mat+khau',
      categorySlug: 'tai-khoan-va-dang-nhap',
    })

    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Tài khoản và đăng nhập',
    })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: new RegExp(article.title) })).toBeInTheDocument()
    expect(getPublicKnowledgeArticles.mock.calls[0][0]).not.toHaveProperty('q')
    expect(getPublicKnowledgeArticles.mock.calls[0][0]).not.toHaveProperty('type')

    const filter = screen.getByRole('searchbox', { name: 'Tìm kiếm trong tất cả chuyên mục' })
    fireEvent.change(filter, { target: { value: 'du lieu ca nhan' } })
    await waitFor(() => expect(getPublicKnowledgeArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: 'du lieu ca nhan',
        page: 1,
        page_size: 60,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(getPublicKnowledgeArticles.mock.calls.at(-1)[0]).not.toHaveProperty('category')
    expect(await screen.findByRole('status')).toHaveTextContent('Tìm thấy 1 kết quả cho “du lieu ca nhan”')
    expect(screen.getByText('Dữ liệu cá nhân', { selector: 'mark' })).toBeInTheDocument()
    expect(screen.getByText(securityArticle.category.name, { selector: '.knowledge-question__category' })).toBeInTheDocument()
    expect(screen.getByText(securityArticle.excerpt)).toBeInTheDocument()
    expect(container.querySelector('.knowledge-question__excerpt')).toHaveAttribute('title', securityArticle.excerpt)

    fireEvent.change(filter, { target: { value: 'kiem soat quyen rieng' } })
    expect(await screen.findByText('Kiểm soát quyền riêng', { selector: 'mark' })).toBeInTheDocument()
  })

  it('shows a real client-side not-found state for an unknown category', async () => {
    renderBrowser({
      entry: '/tro-giup/khong-ton-tai',
      categorySlug: 'khong-ton-tai',
    })

    expect(await screen.findByText('Chuyên mục trợ giúp không tồn tại')).toBeInTheDocument()
    expect(getPublicKnowledgeArticles).not.toHaveBeenCalled()
  })

  it('keeps an explicit empty search URL out of the index after hydration', async () => {
    const metadata = vi.fn(() => () => {})

    renderBrowser({ entry: '/tro-giup?q=', metadata })

    await screen.findByRole('heading', { level: 1, name: 'Câu hỏi thường gặp' })
    await waitFor(() => expect(metadata).toHaveBeenLastCalledWith(
      expect.objectContaining({ robots: 'noindex, nofollow' }),
    ))
  })
})
