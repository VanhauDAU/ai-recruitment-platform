import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conversationKeys } from '@/entities/messaging/conversation'
import { fillThreadGap } from './thread-sync'

const { getConversationMessages } = vi.hoisted(() => ({ getConversationMessages: vi.fn() }))

vi.mock('@/entities/messaging/conversation', async (importOriginal) => ({
  ...(await importOriginal()),
  getConversationMessages,
}))

function fakeQueryClient(thread) {
  const store = new Map([[JSON.stringify(conversationKeys.messages('candidate', 'cnv_1')), thread]])
  return {
    getQueryData: (key) => store.get(JSON.stringify(key)),
    setQueryData: (key, update) => store.set(JSON.stringify(key), update(store.get(JSON.stringify(key)))),
    invalidateQueries: vi.fn(),
    thread: () => store.get(JSON.stringify(conversationKeys.messages('candidate', 'cnv_1'))),
  }
}

const msg = (seq) => ({ seq, kind: 'text', body: `m${seq}` })

describe('fillThreadGap', () => {
  beforeEach(() => getConversationMessages.mockReset())

  it('pages forward from the last cached seq until the server has no more', async () => {
    const client = fakeQueryClient({ messages: [msg(1), msg(2)], hasMore: false })
    getConversationMessages
      .mockResolvedValueOnce({ results: [msg(3), msg(4)], has_more: true })
      .mockResolvedValueOnce({ results: [msg(5)], has_more: false })

    await fillThreadGap(client, 'candidate', 'cnv_1')

    expect(getConversationMessages.mock.calls.map(([, , params]) => params.after)).toEqual([2, 4])
    expect(client.thread().messages.map((message) => message.seq)).toEqual([1, 2, 3, 4, 5])
    expect(client.invalidateQueries).not.toHaveBeenCalled()
  })

  it('reloads the newest page when the gap is wider than five pages', async () => {
    const client = fakeQueryClient({ messages: [msg(1)], hasMore: false })
    let seq = 1
    getConversationMessages.mockImplementation(async () => ({ results: [msg((seq += 1))], has_more: true }))

    await fillThreadGap(client, 'candidate', 'cnv_1')

    expect(getConversationMessages).toHaveBeenCalledTimes(5)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: conversationKeys.messages('candidate', 'cnv_1'),
    })
  })

  it('does nothing for a thread that is not cached', async () => {
    const client = fakeQueryClient(undefined)
    await fillThreadGap(client, 'candidate', 'cnv_1')
    expect(getConversationMessages).not.toHaveBeenCalled()
  })

  it('folds calls made during a running fill into one more pass, and survives network errors', async () => {
    const client = fakeQueryClient({ messages: [msg(1)], hasMore: false })
    let release
    getConversationMessages
      .mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ results: [msg(2)], has_more: false }) }))
      .mockRejectedValueOnce(new Error('offline'))

    const first = fillThreadGap(client, 'candidate', 'cnv_1')
    const second = fillThreadGap(client, 'candidate', 'cnv_1')
    expect(second).toBe(first)
    release()
    await expect(first).resolves.toBeUndefined()

    expect(getConversationMessages).toHaveBeenCalledTimes(2)
    expect(client.thread().messages.map((message) => message.seq)).toEqual([1, 2])
  })
})
