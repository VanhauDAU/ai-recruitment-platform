import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import KnowledgeRevisionReview from './KnowledgeRevisionReview'

const { runAdminKnowledgeRevisionAction } = vi.hoisted(() => ({
  runAdminKnowledgeRevisionAction: vi.fn(),
}))

vi.mock('@/entities/knowledgebase', async (importOriginal) => ({
  ...(await importOriginal()),
  runAdminKnowledgeRevisionAction,
}))

const article = {
  public_id: 'kba_1',
  revision_token: 5,
  published_revision_number: null,
  revisions: [{
    number: 2,
    status: 'IN_REVIEW',
    title: 'Đổi email thế nào?',
    body_plain_text: 'Nội dung mới',
    created_by: { name: 'Biên tập viên' },
    created_at: '2026-08-04T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
  }],
}

describe('KnowledgeRevisionReview', () => {
  it('requires a note when rejecting and submits the optimistic token', async () => {
    runAdminKnowledgeRevisionAction.mockResolvedValue({ ...article, revision_token: 6 })
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <KnowledgeRevisionReview article={article} canManage canReview />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Yêu cầu chỉnh sửa/ }))
    fireEvent.change(screen.getByPlaceholderText('Nêu rõ phần cần chỉnh sửa…'), { target: { value: 'Cần cập nhật ảnh bước 2.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trả lại' }))

    await waitFor(() => expect(runAdminKnowledgeRevisionAction).toHaveBeenCalledWith(
      'kba_1',
      2,
      'reject',
      { revision_token: 5, review_note: 'Cần cập nhật ảnh bước 2.' },
    ))
  })
})
