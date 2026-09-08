import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEmployerActivities,
  getEmployerNotifications,
  getEmployerNotificationUnreadCount,
  getEmployerNotificationPreferences,
  markAllEmployerNotificationsRead,
  markEmployerNotificationRead,
  updateEmployerNotificationPreferences,
} from './employer-notification.api'

const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('employer notification API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: {} })
    post.mockReset().mockResolvedValue({ data: {} })
    patch.mockReset().mockResolvedValue({ data: {} })
  })

  it('reads and updates only the configurable employer email preference', async () => {
    await getEmployerNotificationPreferences()
    await updateEmployerNotificationPreferences({ intermediate_verification_email: false })

    expect(get).toHaveBeenCalledWith('/employer/notification-preferences/')
    expect(patch).toHaveBeenCalledWith('/employer/notification-preferences/', {
      intermediate_verification_email: false,
    })
  })

  it('uses the canonical list, unread and activity contracts', async () => {
    await getEmployerNotifications(2)
    await getEmployerNotificationUnreadCount()
    await getEmployerActivities(3)

    expect(get).toHaveBeenNthCalledWith(1, '/employer/notifications/', { params: { page: 2 } })
    expect(get).toHaveBeenNthCalledWith(2, '/employer/notifications/unread-count/')
    expect(get).toHaveBeenNthCalledWith(3, '/employer/activities/', { params: { page: 3 } })
  })

  it('marks one or all notifications through explicit actions', async () => {
    await markEmployerNotificationRead('eno_1')
    await markAllEmployerNotificationsRead()

    expect(post).toHaveBeenNthCalledWith(1, '/employer/notifications/eno_1/read/')
    expect(post).toHaveBeenNthCalledWith(2, '/employer/notifications/read-all/')
  })
})
