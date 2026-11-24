import { fetchAllPages } from '@/shared/api/pagination'
import { cachedRequest } from '@/shared/api/request-deduplication'

const LOCATION_CACHE_TTL = 10 * 60 * 1000

export async function getProvinces() {
  return cachedRequest('locations:province', LOCATION_CACHE_TTL, () => fetchAllPages('/public/locations/', { level: 'province' }))
}

export async function getWards(provinceId) {
  return cachedRequest(`locations:ward:${provinceId}`, LOCATION_CACHE_TTL, () => fetchAllPages('/public/locations/', { level: 'ward', parent: provinceId }))
}

export async function getLocationsByIds(ids = []) {
  if (!ids.length) return []
  return fetchAllPages('/public/locations/', { ids: ids.join(',') })
}
