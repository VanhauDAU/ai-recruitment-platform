import api from '@/shared/api/client'
import {
  normalizeAdminAnnouncementDetail,
  normalizeAdminAnnouncementMetrics,
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

export async function getAdminAnnouncementMetrics(publicId, params = {}, { signal } = {}) {
  const result = await data(
    api.get(`/site/admin/announcements/${publicId}/metrics/`, { params, signal }),
  )
  return normalizeAdminAnnouncementMetrics(result)
}

export async function uploadAdminAnnouncementBackground(file) {
  const body = new FormData()
  body.append('file', file)
  const result = await data(
    api.post('/site/admin/announcements/backgrounds/', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
  return {
    path: result.path || '',
    url: result.url || '',
    width: result.width,
    height: result.height,
  }
}
