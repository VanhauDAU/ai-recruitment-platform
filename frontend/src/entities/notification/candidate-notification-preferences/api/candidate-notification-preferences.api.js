import api from '@/shared/api/client'

export async function getCandidateNotificationPreferences() {
  const { data } = await api.get('/candidate/email-notification-settings/')
  return data
}

export async function updateCandidateNotificationPreferences(changes) {
  const { data } = await api.patch('/candidate/email-notification-settings/', changes)
  return data
}
