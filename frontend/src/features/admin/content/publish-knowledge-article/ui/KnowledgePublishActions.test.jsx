import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigProvider } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import KnowledgePublishActions from './KnowledgePublishActions'

const { discardAdminKnowledgeDraft, publishAdminKnowledgeRevision } = vi.hoisted(() => ({
  discardAdminKnowledgeDraft: vi.fn(),
  publishAdminKnowledgeRevision: vi.fn(),
}))

vi.mock('@/entities/content/knowledgebase', async (importOriginal) => ({
  ...(await importOriginal()),
  discardAdminKnowledgeDraft,
  publishAdminKnowledgeRevision,
}))

const published = {
  public_id: 'kba_1',
  title: 'Đổi email thế nào?',
  lifecycle_state: 'ACTIVE',
  revision_token: 5,
  published_revision_number: 1,
  category: { review_interval_days: 90 },
  revisions: [{ number: 1, status: 'PUBLISHED' }],
}
const withDraft = { ...published, revision_token: 6, revisions: [{ number: 2, status: 'DRAFT' }, ...published.revisions] }

function renderActions(props) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <ConfigProvider theme={{ token: { motion: false } }} wave={{ disabled: true }}>
      <QueryClientProvider client={queryClient}>
        <KnowledgePublishActions {...props} />
      </QueryClientProvider>
    </ConfigProvider>,
  )
}

describe('KnowledgePublishActions', () => {
  it('saves unsaved edits first, then publishes the resulting draft with the fresh token', async () => {
    const user = userEvent.setup()
    const prepare = vi.fn().mockResolvedValue(withDraft)
    publishAdminKnowledgeRevision.mockResolvedValue({ ...withDraft, revision_token: 7, published_revision_number: 2 })
    renderActions({ article: published, dirty: true, prepare })

    await user.click(screen.getByRole('button', { name: /Lưu & xuất bản/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Xuất bản bản nháp r2' })
    expect(dialog).toHaveTextContent('thay bản đang công khai r1')
    await user.click(within(dialog).getByRole('button', { name: 'Xuất bản ngay' }))

    expect(prepare).toHaveBeenCalledOnce()
    await waitFor(() => expect(publishAdminKnowledgeRevision).toHaveBeenCalledWith('kba_1', expect.objectContaining({
      revision_number: 2,
      revision_token: 6,
    })))
  })

  it('does not open the dialog when saving fails validation', async () => {
    const user = userEvent.setup()
    renderActions({ article: published, dirty: true, prepare: vi.fn().mockResolvedValue(null) })

    await user.click(screen.getByRole('button', { name: /Lưu & xuất bản/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('discards the draft of a published article', async () => {
    const user = userEvent.setup()
    discardAdminKnowledgeDraft.mockResolvedValue({ ...published, revision_token: 7 })
    renderActions({ article: withDraft, dirty: false, prepare: vi.fn() })

    await user.click(screen.getByRole('button', { name: /Hủy bản nháp/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hủy bản nháp' })
    await user.click(within(dialog).getByRole('button', { name: 'Hủy bản nháp' }))

    await waitFor(() => expect(discardAdminKnowledgeDraft).toHaveBeenCalledWith('kba_1', 2, 6))
  })
})
