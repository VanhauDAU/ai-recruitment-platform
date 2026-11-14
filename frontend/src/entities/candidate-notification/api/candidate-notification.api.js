import api from '@/shared/api/client'

export async function getCandidateNotifications(page = 1) {
  const { data } = await api.get('/candidate/notifications/', { params: { page } })
  return data
}

export async function getCandidateNotificationUnreadCount() {
  const { data } = await api.get('/candidate/notifications/unread-count/')
  return data
}

export async function markCandidateNotificationRead(publicId) {
  const { data } = await api.post(`/candidate/notifications/${publicId}/read/`)
  return data
}

export async function markAllCandidateNotificationsRead() {
  const { data } = await api.post('/candidate/notifications/read-all/')
  return data
}
