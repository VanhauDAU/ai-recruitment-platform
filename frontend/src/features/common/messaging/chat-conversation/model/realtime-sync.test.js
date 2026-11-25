import { describe, expect, it } from 'vitest'
import { applyReadEvent, listsAfterMessage, shouldSendTyping } from './realtime-sync'

const list = (...ids) => ({ pages: [{ results: ids.map((id) => ({ public_id: id, unread_count: 0, last_seq: 1 })) }] })
const message = { seq: 2, kind: 'text', body: 'Chào bạn', mine: false, created_at: '2026-11-26T08:00:00Z' }

describe('listsAfterMessage', () => {
  it('updates every cached list holding the conversation and flags the unfiltered list missing it', () => {
    const entries = [
      [['conversations', 'candidate', 'list', ''], list('cnv_b')],
      [['conversations', 'candidate', 'list', 'abc'], list('cnv_a')],
      [['conversations', 'candidate', 'list', 'x'], undefined],
    ]
    const { updates, missing } = listsAfterMessage(entries, 'cnv_a', message, { unreadCount: 4 })
    expect(updates).toHaveLength(1)
    expect(updates[0][1].pages[0].results[0]).toMatchObject({ public_id: 'cnv_a', unread_count: 4 })
    expect(missing).toBe(true)
  })

  it('keeps the open conversation read', () => {
    const { updates, missing } = listsAfterMessage([[['conversations', 'employer', 'list', ''], list('cnv_a')]], 'cnv_a', message, { unreadCount: 1, open: true })
    expect(updates[0][1].pages[0].results[0].unread_count).toBe(0)
    expect(missing).toBe(false)
  })
})

describe('applyReadEvent', () => {
  const detail = { my_role: 'candidate', peer_last_read_seq: 3 }

  it('moves the peer read marker forward only', () => {
    expect(applyReadEvent({ detail, myRole: 'candidate' }, { role: 'recruiter', last_read_seq: 7 }).detail.peer_last_read_seq).toBe(7)
    expect(applyReadEvent({ detail, myRole: 'candidate' }, { role: 'recruiter', last_read_seq: 2 }).detail).toBe(detail)
  })

  it('treats my own read (another tab) as clearing the unread row', () => {
    const lists = [[['conversations', 'candidate', 'list', ''], { pages: [{ results: [{ public_id: 'cnv_a', unread_count: 2 }] }] }]]
    const next = applyReadEvent({ detail, lists, myRole: 'candidate' }, { role: 'candidate', conversation: 'cnv_a', last_read_seq: 9 })
    expect(next.mine).toBe(true)
    expect(next.lists[0][1].pages[0].results[0].unread_count).toBe(0)
  })
})

it('throttles typing signals to one per three seconds', () => {
  expect(shouldSendTyping(0, 10_000)).toBe(true)
  expect(shouldSendTyping(8_000, 10_000)).toBe(false)
  expect(shouldSendTyping(7_000, 10_000)).toBe(true)
})
