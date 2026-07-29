import api from '@/shared/api/client'
import { normalizeAnnouncementFeed } from '../model/announcement.contract'

export async function getActiveAnnouncements(params, { signal } = {}) {
  const { data } = await api.get('/site/announcements/active/', {
    params: {
      surface: params.surface,
      path: params.path,
      locale: params.locale,
    },
    signal,
  })
  return normalizeAnnouncementFeed(data)
}

export async function setAnnouncementState(publicId, payload) {
  const { data } = await api.put(`/site/announcements/${publicId}/state/`, payload)
  return data
}

export async function sendAnnouncementEvents(events) {
  if (!events.length) return
  await api.post('/site/announcements/events/', { events })
}
