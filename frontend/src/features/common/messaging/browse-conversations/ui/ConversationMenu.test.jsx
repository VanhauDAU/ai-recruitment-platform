import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConversationMenu from './ConversationMenu'

const api = vi.hoisted(() => ({ clearConversation: vi.fn(), setConversationBlocked: vi.fn() }))
vi.mock('@/entities/messaging/conversation/api/conversation.api', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

function renderMenu(conversation) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ConversationMenu portal="candidate" conversation={{ public_id: 'cnv_1', counterpart: { name: 'Acme' }, ...conversation }} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ConversationMenu', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the conversation for me after confirming', async () => {
    const user = userEvent.setup()
    api.clearConversation.mockResolvedValue()
    renderMenu({})

    await user.click(screen.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện' }))
    await user.click(screen.getByRole('menuitem', { name: /Xóa cuộc trò chuyện/ }))
    expect(screen.getByText(/chỉ bị xóa ở phía bạn/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Xóa cuộc trò chuyện' }).at(-1))

    await waitFor(() => expect(api.clearConversation).toHaveBeenCalledWith('candidate', 'cnv_1'))
  })

  it('unblocks at once when I blocked the conversation', async () => {
    const user = userEvent.setup()
    api.setConversationBlocked.mockResolvedValue({ public_id: 'cnv_1', blocked_by_me: false })
    renderMenu({ blocked_by_me: true })

    await user.click(screen.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện' }))
    await user.click(screen.getByRole('menuitem', { name: /Bỏ chặn/ }))

    await waitFor(() => expect(api.setConversationBlocked).toHaveBeenCalledWith('candidate', 'cnv_1', false))
  })
})
