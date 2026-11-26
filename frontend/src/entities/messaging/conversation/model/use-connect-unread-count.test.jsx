import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/test/render-with-query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { useConnectUnreadCount } from './use-connect-unread-count'

const mocks = vi.hoisted(() => ({ announceNotice: vi.fn(), handler: null }))
vi.mock('@/shared/lib/incoming-notice', () => ({ announceNotice: mocks.announceNotice }))
vi.mock('@/shared/api/use-realtime', () => ({
  useRealtimeOpen: () => true,
  useRealtimeEvents: (handler) => { mocks.handler = handler },
}))
vi.mock('../api/conversation.api', () => ({ getConversationUnreadCount: vi.fn(() => Promise.resolve({ count: 0 })) }))

function wrapper({ children }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('useConnectUnreadCount', () => {
  beforeEach(() => mocks.announceNotice.mockReset())

  it('announces an incoming message with the message sound', () => {
    renderHook(() => useConnectUnreadCount('candidate'), { wrapper })
    mocks.handler({
      type: 'chat.message.created',
      conversation: 'cv_1',
      message: { public_id: 'msg_1', kind: 'text', body: 'Chào bạn', mine: false },
    })

    expect(mocks.announceNotice).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg_1', sound: 'message' }))
  })

  it('stays quiet for the user’s own messages', () => {
    renderHook(() => useConnectUnreadCount('candidate'), { wrapper })
    mocks.handler({ type: 'chat.message.created', conversation: 'cv_1', message: { public_id: 'msg_2', mine: true } })

    expect(mocks.announceNotice).not.toHaveBeenCalled()
  })
})
