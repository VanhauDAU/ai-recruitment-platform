import api from '@/shared/api/client'

export async function getEmployerNotifications(page = 1) {
  const { data } = await api.get('/employer/notifications/', { params: { page } })
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

export async function getEmployerActivities(page = 1) {
  const { data } = await api.get('/employer/activities/', { params: { page } })
  return data
}
