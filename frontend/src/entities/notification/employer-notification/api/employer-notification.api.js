import api from '@/shared/api/client'

/** One page of the inbox; `params` may hold `page`, `category` and `unread`. */
export async function getEmployerNotifications(params = {}) {
  const { data } = await api.get('/employer/notifications/', { params })
  return data
}

export async function getEmployerNotificationUnreadCount() {
  const { data } = await api.get('/employer/notifications/unread-count/')
  return data
}

export async function getEmployerNotificationPreferences() {
  const { data } = await api.get('/employer/notification-preferences/')
  return data
}

export async function updateEmployerNotificationPreferences(payload) {
  const { data } = await api.patch('/employer/notification-preferences/', payload)
  return data
}

export async function markEmployerNotificationRead(publicId) {
  const { data } = await api.post(`/employer/notifications/${publicId}/read/`)
  return data
}

export async function markAllEmployerNotificationsRead() {
  const { data } = await api.post('/employer/notifications/read-all/')
  return data
}

/** One page of the history; `params` may hold `page`, `category` and `days`. */
export async function getEmployerActivities(params = {}) {
  const { data } = await api.get('/employer/activities/', { params })
  return data
}
