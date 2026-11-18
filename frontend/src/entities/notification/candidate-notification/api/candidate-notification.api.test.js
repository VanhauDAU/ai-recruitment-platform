import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCandidateNotifications,
  getCandidateNotificationUnreadCount,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
} from './candidate-notification.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('candidate notification API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: {} })
    post.mockReset().mockResolvedValue({ data: {} })
  })

  it('uses the candidate inbox endpoints', async () => {
    await getCandidateNotifications(2)
    await getCandidateNotificationUnreadCount()
    await markCandidateNotificationRead('cno_1')
    await markAllCandidateNotificationsRead()

    expect(get).toHaveBeenNthCalledWith(1, '/candidate/notifications/', { params: { page: 2 } })
    expect(get).toHaveBeenNthCalledWith(2, '/candidate/notifications/unread-count/')
    expect(post).toHaveBeenNthCalledWith(1, '/candidate/notifications/cno_1/read/')
    expect(post).toHaveBeenNthCalledWith(2, '/candidate/notifications/read-all/')
  })
})
