import { fetchAllPages } from './pagination'
import { cachedRequest } from './requestDeduplication'

const LOCATION_CACHE_TTL = 10 * 60 * 1000

export async function getProvinces() {
  return cachedRequest('locations:province', LOCATION_CACHE_TTL, () => fetchAllPages('/locations/', { level: 'province' }))
}

export async function getWards(provinceId) {
  return cachedRequest(`locations:ward:${provinceId}`, LOCATION_CACHE_TTL, () => fetchAllPages('/locations/', { level: 'ward', parent: provinceId }))
}

// Fetch wards for several provinces in one request to avoid an N+1 fan-out.
export async function getWardsByParents(parentIds = []) {
  const ids = [...new Set(parentIds)].filter((id) => id != null)
  if (!ids.length) return []
  const key = `locations:ward:${[...ids].sort((a, b) => a - b).join(',')}`
  return cachedRequest(key, LOCATION_CACHE_TTL, () => fetchAllPages('/locations/', { level: 'ward', parent: ids.join(',') }))
}

export async function getLocationsByIds(ids = []) {
  if (!ids.length) return []
  return fetchAllPages('/locations/', { ids: ids.join(',') })
}
