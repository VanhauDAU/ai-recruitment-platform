import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicKnowledgeArticle from './PublicKnowledgeArticle'

const { getPublicKnowledgeArticle, getPublicKnowledgeCategories } = vi.hoisted(() => ({
  getPublicKnowledgeArticle: vi.fn(),
  getPublicKnowledgeCategories: vi.fn(),
}))

vi.mock('@/entities/knowledgebase', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicKnowledgeArticle,
  getPublicKnowledgeCategories,
}))

const category = {
  public_id: 'kbc_account',
  name: 'Tài khoản và đăng nhập',
  slug: 'tai-khoan-va-dang-nhap',
  article_count: 2,
}

const related = {
  public_id: 'kba_reset',
  category,
  slug: 'dat-lai-mat-khau',
  article_type: 'GUIDE',
  title: 'Làm thế nào để đặt lại mật khẩu?',
  excerpt: 'Mở trang quên mật khẩu.',
  order: 1,
  updated_at: '2026-08-05T08:00:00Z',
}

const article = {
  public_id: 'kba_login',
  category,
  slug: 'dang-nhap-an-toan',
  article_type: 'FAQ',
  title: 'Làm thế nào để đăng nhập an toàn?',
  excerpt: 'Đăng nhập bằng thông tin của bạn.',
  order: 2,
  body: '<h2>Các bước</h2><p>Nhập email.</p><img src="https://cdn.example.com/help/login.webp" alt="Minh họa đăng nhập"><script>steal()</script>',
  seo_title: 'Đăng nhập an toàn',
  seo_description: 'Hướng dẫn đăng nhập.',
  published_at: '2026-08-01T08:00:00Z',
  updated_at: '2026-08-05T08:00:00Z',
  related_articles: [related],
  previous_article: null,
  next_article: related,
}

function renderArticle() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PublicKnowledgeArticle
          categorySlug="tai-khoan-va-dang-nhap"
          articleSlug="dang-nhap-an-toan"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicKnowledgeArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicKnowledgeCategories.mockResolvedValue([category])
    getPublicKnowledgeArticle.mockResolvedValue(article)
  })

  it('renders a single h1, sanitized rich content and next navigation', async () => {
    const { container } = renderArticle()

    expect(await screen.findByRole('heading', { level: 1, name: article.title })).toBeInTheDocument()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Các bước' })).toBeInTheDocument()
    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/help/login.webp')
    expect(container.querySelector('img')).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(screen.getByText(/Cập nhật/)).toHaveTextContent(/\d{2}:\d{2}/)
    expect(screen.getByText(/Cập nhật/)).toHaveTextContent('05/08/2026')
    expect(screen.getByText('Câu hỏi tiếp')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Bài viết trước và sau' })).toBeInTheDocument()
    const categoryNavigation = screen.getByRole('navigation', { name: 'Bài trong chuyên mục' })
    expect(within(categoryNavigation).getByText('Tên chuyên mục')).toBeInTheDocument()
    expect(within(categoryNavigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      related.title,
      article.title,
    ])
    expect(within(categoryNavigation).getByRole('link', { name: article.title })).toHaveAttribute('aria-current', 'page')
  })

  it('maps a hidden article 404 to the neutral not-found screen', async () => {
    getPublicKnowledgeArticle.mockRejectedValue({ response: { status: 404 } })
    renderArticle()

    expect(await screen.findByText('Không tìm thấy nội dung trợ giúp')).toBeInTheDocument()
    expect(screen.queryByText(article.title)).not.toBeInTheDocument()
  })
})
