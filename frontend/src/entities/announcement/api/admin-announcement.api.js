import api from '@/shared/api/client'
import {
  normalizeAdminAnnouncementDetail,
  normalizeAdminAnnouncementPage,
} from '../model/admin-announcement.contract'

async function data(request) {
  const response = await request
  return response.data
}

export async function getAdminAnnouncements(params = {}, { signal } = {}) {
  const result = await data(api.get('/site/admin/announcements/', { params, signal }))
  return normalizeAdminAnnouncementPage(result)
}

export async function getAdminAnnouncement(publicId, { signal } = {}) {
  const result = await data(api.get(`/site/admin/announcements/${publicId}/`, { signal }))
  return normalizeAdminAnnouncementDetail(result)
}

export async function createAdminAnnouncement(payload) {
  const result = await data(api.post('/site/admin/announcements/', payload))
  return normalizeAdminAnnouncementDetail(result)
}

export async function renameAdminAnnouncement(publicId, payload) {
  const result = await data(api.patch(`/site/admin/announcements/${publicId}/`, payload))
  return normalizeAdminAnnouncementDetail(result)
}

export async function createAdminAnnouncementRevision(publicId, payload) {
  const result = await data(
    api.post(`/site/admin/announcements/${publicId}/revisions/`, payload),
  )
  return normalizeAdminAnnouncementDetail(result)
}

export async function runAdminAnnouncementAction(publicId, action, payload) {
  const result = await data(
    api.post(`/site/admin/announcements/${publicId}/${action}/`, payload),
  )
  return normalizeAdminAnnouncementDetail(result)
}

export async function duplicateAdminAnnouncement(publicId, payload) {
  const result = await data(
    api.post(`/site/admin/announcements/${publicId}/duplicate/`, payload),
  )
  return normalizeAdminAnnouncementDetail(result)
}
