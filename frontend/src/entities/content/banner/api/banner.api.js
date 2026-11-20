import api from '@/shared/api/client'
import { cachedRequest } from '@/shared/api/request-deduplication'

const PUBLIC_CACHE_TTL = 5 * 60 * 1000
const ADMIN_BASE = '/admin/site/banners/'

export async function getBanners(placement) {
  return cachedRequest(`banners:${placement || 'all'}`, PUBLIC_CACHE_TTL, async () => {
    const { data } = await api.get('/public/site/banners/', { params: placement ? { placement } : {} })
    return data
  })
}

export async function getAdminBanners(placement, { signal } = {}) {
  const { data } = await api.get(ADMIN_BASE, { params: { placement }, signal })
  return data
}

export async function createAdminBanner(payload) {
  const { data } = await api.post(ADMIN_BASE, payload)
  return data
}

export async function updateAdminBanner(id, payload) {
  const { data } = await api.patch(`${ADMIN_BASE}${id}/`, payload)
  return data
}

export async function deleteAdminBanner(id) {
  await api.delete(`${ADMIN_BASE}${id}/`)
}

export async function reorderAdminBanners(placement, ids) {
  await api.post(`${ADMIN_BASE}reorder/`, { placement, ids })
}

export async function uploadAdminBannerImage(file, { placement, kind }) {
  const body = new FormData()
  body.append('file', file)
  body.append('placement', placement)
  body.append('kind', kind)
  const { data } = await api.post(`${ADMIN_BASE}images/`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return { path: data.path || '', url: data.url || '' }
}
