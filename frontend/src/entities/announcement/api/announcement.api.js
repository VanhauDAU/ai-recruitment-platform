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
