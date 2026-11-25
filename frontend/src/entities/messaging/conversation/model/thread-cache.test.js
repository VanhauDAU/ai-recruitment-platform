// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isConversationInView, setActiveConversation } from './active-conversation'
import { appendNewer, newClientId, patchPendingMessage, prependOlder } from './messages'

const msg = (seq, extra = {}) => ({ seq, client_id: null, kind: 'text', body: `#${seq}`, ...extra })

describe('thread pages', () => {
  it('prepends older history and keeps its has_more, appends newer without touching it', () => {
    const thread = { messages: [msg(5), msg(6)], hasMore: true }
    const older = prependOlder(thread, { results: [msg(3), msg(4)], has_more: false })
    expect(older.messages.map((message) => message.seq)).toEqual([3, 4, 5, 6])
    expect(older.hasMore).toBe(false)

    const newer = appendNewer(thread, { results: [msg(7)], has_more: true })
    expect(newer.messages.map((message) => message.seq)).toEqual([5, 6, 7])
    expect(newer.hasMore).toBe(true)
    expect(appendNewer(undefined, undefined)).toEqual({ messages: [], hasMore: false })
  })

  it('patches only the pending copy with the matching client id', () => {
    const thread = {
      messages: [msg(1, { client_id: 'a' }), { seq: null, client_id: 'a', status: 'sending' }, { seq: null, client_id: 'b' }],
      hasMore: false,
    }
    const patched = patchPendingMessage(thread, 'a', { status: 'failed' })
    expect(patched.messages.map((message) => message.status)).toEqual([undefined, 'failed', undefined])
    expect(patchPendingMessage(undefined, 'a', {})).toBeUndefined()
  })
})

describe('newClientId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses crypto.randomUUID when present', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' })
    expect(newClientId()).toBe('uuid-1')
  })

  it('falls back to a v4-shaped id without a secure context', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newClientId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('active conversation', () => {
  it('reports only the registered conversation, and unregisters only itself', () => {
    const leaveA = setActiveConversation('cnv_a')
    expect(isConversationInView('cnv_a')).toBe(true)
    expect(isConversationInView('cnv_b')).toBe(false)
    expect(isConversationInView('')).toBe(false)

    const leaveB = setActiveConversation('cnv_b')
    leaveA()
    expect(isConversationInView('cnv_b')).toBe(true)
    leaveB()
    expect(isConversationInView('cnv_b')).toBe(false)
  })
})
