import { describe, expect, it } from 'vitest'
import {
  applyIncomingMessage,
  lastPeerSeq,
  mergeMessages,
  optimisticMessage,
  reconcileLatest,
  replaceMessage,
  seenMessageSeq,
} from './messages'

const msg = (seq, extra = {}) => ({ public_id: `msg_${seq}`, seq, client_id: null, kind: 'text', body: `#${seq}`, mine: false, ...extra })
const pending = (clientId) => optimisticMessage({ clientId, payload: { kind: 'text', body: 'hi' } })

describe('mergeMessages', () => {
  it('orders by seq, dedupes and keeps unsent messages last', () => {
    const merged = mergeMessages([msg(2), pending('c1'), msg(1)], [msg(2, { body: 'edited' }), msg(3)])
    expect(merged.map((item) => item.seq ?? item.client_id)).toEqual([1, 2, 3, 'c1'])
    expect(merged[1].body).toBe('edited')
  })

  it('replaces the optimistic copy once the server confirms the same client_id', () => {
    const merged = mergeMessages([msg(1), pending('c1')], [msg(2, { client_id: 'c1', mine: true })])
    expect(merged.map((item) => item.seq)).toEqual([1, 2])
  })
})

describe('applyIncomingMessage', () => {
  const thread = { messages: [msg(1), msg(2)], hasMore: false }

  it('appends the next seq and ignores a duplicate', () => {
    expect(applyIncomingMessage(thread, msg(3)).thread.messages).toHaveLength(3)
    expect(applyIncomingMessage(thread, msg(2)).thread.messages).toHaveLength(2)
  })

  it('reports a gap instead of inserting a message that skips seqs', () => {
    const result = applyIncomingMessage(thread, msg(5))
    expect(result.gap).toBe(true)
    expect(result.thread).toBe(thread)
  })

  it('leaves a thread that is not loaded alone', () => {
    expect(applyIncomingMessage(undefined, msg(1))).toEqual({ thread: undefined, gap: false })
  })
})

describe('reconcileLatest', () => {
  it('merges the newest page into older history when they touch', () => {
    const previous = { messages: [msg(1), msg(2), msg(3)], hasMore: false }
    const next = reconcileLatest(previous, { results: [msg(3), msg(4)], has_more: true })
    expect(next).toEqual({ messages: [msg(1), msg(2), msg(3), msg(4)], hasMore: false })
  })

  it('drops history separated from the newest page by a hole but keeps unsent messages', () => {
    const previous = { messages: [msg(1), pending('c1')], hasMore: false }
    const next = reconcileLatest(previous, { results: [msg(40), msg(41)], has_more: true })
    expect(next.messages.map((item) => item.seq ?? item.client_id)).toEqual([40, 41, 'c1'])
    expect(next.hasMore).toBe(true)
  })
})

describe('thread markers', () => {
  it('replaces only messages the thread already has', () => {
    const thread = { messages: [msg(1)], hasMore: false }
    expect(replaceMessage(thread, msg(1, { body: 'new' })).messages[0].body).toBe('new')
    expect(replaceMessage(thread, msg(9))).toBe(thread)
  })

  it('marks my last delivered message seen once the peer read up to it', () => {
    const messages = [msg(1), msg(2, { mine: true }), msg(3, { mine: true }), pending('c1')]
    expect(seenMessageSeq(messages, 3)).toBe(3)
    expect(seenMessageSeq(messages, 2)).toBeNull()
    expect(lastPeerSeq(messages)).toBe(1)
  })
})
