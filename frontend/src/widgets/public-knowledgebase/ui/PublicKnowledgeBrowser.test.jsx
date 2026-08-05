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
    article_count: 0,
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
    getPublicKnowledgeArticles.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [article],
    })
  })

  it('renders one h1, accessible navigation and published help content', async () => {
    const { container } = renderBrowser()

    expect(await screen.findByRole('heading', { level: 1, name: 'Câu hỏi thường gặp' })).toBeInTheDocument()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('searchbox', { name: 'Tìm trong danh sách câu hỏi' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Chuyên mục trợ giúp' })).toBeInTheDocument()
    expect(screen.queryByText('Tất cả chủ đề')).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Làm thế nào để đăng nhập an toàn/ })).toHaveAttribute(
      'href',
      '/tro-giup/tai-khoan-va-dang-nhap/dang-nhap-an-toan',
    )
  })

  it('filters the loaded question list locally and ignores legacy API search parameters', async () => {
    const { container } = renderBrowser({
      entry: '/tro-giup/tai-khoan-va-dang-nhap?type=faq&q=mat+khau',
      categorySlug: 'tai-khoan-va-dang-nhap',
    })

    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Tài khoản và đăng nhập',
    })).toBeInTheDocument()
    const filter = screen.getByRole('searchbox', { name: 'Tìm trong danh sách câu hỏi' })
    fireEvent.change(filter, { target: { value: 'không khớp' } })
    expect(screen.getByText('Không tìm thấy câu hỏi phù hợp.')).toBeInTheDocument()
    fireEvent.change(filter, { target: { value: 'dang nhap an toan' } })
    expect(screen.getByRole('link', { name: new RegExp(article.title) })).toBeInTheDocument()
    expect(screen.getByText('đăng nhập an toàn', { selector: 'mark' })).toBeInTheDocument()
    expect(screen.getByText(article.excerpt)).toBeInTheDocument()
    expect(container.querySelector('.knowledge-question__excerpt')).toHaveAttribute('title', article.excerpt)
    fireEvent.change(filter, { target: { value: 'email và mật khẩu' } })
    expect(screen.getByText('email và mật khẩu', { selector: 'mark' })).toBeInTheDocument()
    await waitFor(() => expect(getPublicKnowledgeArticles).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'tai-khoan-va-dang-nhap',
        page: 1,
        page_size: 60,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(getPublicKnowledgeArticles.mock.calls[0][0]).not.toHaveProperty('q')
    expect(getPublicKnowledgeArticles.mock.calls[0][0]).not.toHaveProperty('type')
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
