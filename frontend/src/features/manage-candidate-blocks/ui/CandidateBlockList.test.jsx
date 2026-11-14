import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateBlockList from './CandidateBlockList'

const api = vi.hoisted(() => ({ getCandidateBlocks: vi.fn(), liftCandidateBlock: vi.fn() }))
vi.mock('@/entities/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

function renderList() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CandidateBlockList />
    </QueryClientProvider>,
  )
}

describe('CandidateBlockList', () => {
  beforeEach(() => {
    api.getCandidateBlocks.mockReset().mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'cbk_1', candidate_name: 'Nguyễn An', candidate_email: 'an@example.com', reason: 'spam',
        reason_label: 'Ứng tuyển hàng loạt, không phù hợp', note: '', source_job_title: 'Kỹ sư', expires_at: null,
        created_at: '2026-11-15T09:00:00+07:00',
      }],
    })
    api.liftCandidateBlock.mockReset().mockResolvedValue({})
  })

  it('lists blocks and lifts one after confirmation', async () => {
    const user = userEvent.setup()
    renderList()

    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('Không thời hạn', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gỡ chặn' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ chặn' }))

    await waitFor(() => expect(api.liftCandidateBlock).toHaveBeenCalledWith('cbk_1'))
  })

  it('shows an empty state', async () => {
    api.getCandidateBlocks.mockResolvedValue({ count: 0, results: [] })
    renderList()

    expect(await screen.findByText('Bạn chưa chặn ứng viên nào')).toBeInTheDocument()
  })
})
