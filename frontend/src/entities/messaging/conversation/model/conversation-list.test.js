import { describe, expect, it } from 'vitest'
import { applyMessageToList, markListConversationRead } from './conversation-list'

const conversation = (publicId, unread = 0) => ({ public_id: publicId, unread_count: unread, last_seq: 1 })
const list = () => ({ pages: [{ results: [conversation('cnv_a'), conversation('cnv_b', 1)] }, { results: [conversation('cnv_c')] }] })

describe('applyMessageToList', () => {
  it('moves the conversation to the top with the new preview and server unread count', () => {
    const message = { seq: 7, kind: 'text', body: 'Xin chào', sender_role: 'recruiter', created_at: '2026-11-26T08:00:00Z', mine: false }
    const next = applyMessageToList(list(), 'cnv_c', message, { unreadCount: 3 })
    expect(next.pages[0].results.map((item) => item.public_id)).toEqual(['cnv_c', 'cnv_a', 'cnv_b'])
    expect(next.pages[1].results).toEqual([])
    expect(next.pages[0].results[0]).toMatchObject({ unread_count: 3, last_seq: 7, last_message: { preview: 'Xin chào', kind: 'text' } })
  })

  it('keeps the unread count at zero for my own or an open conversation', () => {
    const message = { seq: 2, kind: 'cv', body: '', mine: true }
    expect(applyMessageToList(list(), 'cnv_b', message).pages[0].results[0]).toMatchObject({ unread_count: 0, last_message: { preview: '' } })
  })

  it('returns null for a conversation that is not cached', () => {
    expect(applyMessageToList(list(), 'cnv_x', { seq: 1 })).toBeNull()
  })
})

it('clears the unread count of one conversation', () => {
  const next = markListConversationRead(list(), 'cnv_b')
  expect(next.pages[0].results[1].unread_count).toBe(0)
})
