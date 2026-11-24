import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminKnowledgeBaseManagement from './AdminKnowledgeBaseManagement'

const {
  getAdminKnowledgeArticles,
  getAdminKnowledgeArticleSummary,
  getAdminKnowledgeCategories,
} = vi.hoisted(() => ({
  getAdminKnowledgeArticles: vi.fn(),
  getAdminKnowledgeArticleSummary: vi.fn(),
  getAdminKnowledgeCategories: vi.fn(),
}))

vi.mock('@/entities/content/knowledgebase', async (importOriginal) => ({
  ...await importOriginal(),
  getAdminKnowledgeArticles,
  getAdminKnowledgeArticleSummary,
  getAdminKnowledgeCategories,
}))

const category = {
  public_id: 'kbc_account',
  name: 'Tài khoản',
  slug: 'tai-khoan',
  article_count: 1,
  public_article_count: 1,
  review_interval_days: 180,
  is_active: true,
}

const article = {
  public_id: 'kba_login',
  category,
  slug: 'dang-nhap',
  article_type: 'FAQ',
  title: 'Làm thế nào để đăng nhập?',
  lifecycle_state: 'ACTIVE',
  latest_revision: { number: 2, status: 'DRAFT' },
  published_revision_number: 1,
  review_due_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-09T00:00:00Z',
}

function renderWidget(initialEntry = '/admin/app/knowledgebase') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/app/knowledgebase" element={<AdminKnowledgeBaseManagement />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminKnowledgeBaseManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminKnowledgeCategories.mockResolvedValue([category])
    getAdminKnowledgeArticles.mockResolvedValue({ count: 47, results: [article] })
    getAdminKnowledgeArticleSummary.mockResolvedValue({
      total: 47,
      published: 31,
      drafts: 8,
      overdue: 6,
    })
  })

  it('shows aggregate KPIs returned by the server instead of current-page rows', async () => {
    renderWidget('/admin/app/knowledgebase?q=dang+nhap&page=2')

    expect(await screen.findByText('Làm thế nào để đăng nhập?')).toBeInTheDocument()
    const metrics = screen.getByLabelText('Tổng quan nội dung')
    expect(metrics).toHaveTextContent('47')
    expect(metrics).toHaveTextContent('31')
    expect(metrics).toHaveTextContent('8')
    expect(metrics).toHaveTextContent('6')
    expect(getAdminKnowledgeArticleSummary).toHaveBeenCalledWith(
      { q: 'dang nhap' },
      expect.any(Object),
    )
  })

  it('keeps category and editorial-status ordering controlled by the URL', async () => {
    renderWidget('/admin/app/knowledgebase?page=3')
    await screen.findByText('Làm thế nào để đăng nhập?')

    const header = (name) => screen.getByText(name, { selector: '.ws-sort' })
    fireEvent.click(header('Phân loại'))
    await waitFor(() => expect(getAdminKnowledgeArticles).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ page: expect.anything() }),
      expect.any(Object),
    ))
    expect(getAdminKnowledgeArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({ ordering: 'category' }),
      expect.any(Object),
    )
    expect(header('Phân loại')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(header('Trạng thái'))
    await waitFor(() => expect(getAdminKnowledgeArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({ ordering: 'revision_status' }),
      expect.any(Object),
    ))
    expect(header('Trạng thái')).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters published articles from the tile while keeping tile counts', async () => {
    renderWidget('/admin/app/knowledgebase?q=dang+nhap')
    await screen.findByText('Làm thế nào để đăng nhập?')

    const tile = screen.getByText('Đã công khai', { selector: '.wt-tile__label' }).closest('button')
    fireEvent.click(tile)

    await waitFor(() => expect(getAdminKnowledgeArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'dang nhap', published: 'true' }),
      expect.any(Object),
    ))
    expect(getAdminKnowledgeArticleSummary).toHaveBeenLastCalledWith({ q: 'dang nhap' }, expect.any(Object))
    await waitFor(() => expect(tile).toHaveAttribute('aria-pressed', 'true'))
  })
})
