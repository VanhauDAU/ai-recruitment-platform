import { fetchAllPages } from './pagination'
import { dedupeRequest } from './requestDeduplication'

export async function getProvinces() {
  return dedupeRequest('locations:province', () => fetchAllPages('/locations/', { level: 'province' }))
}

export async function getWards(provinceId) {
  return dedupeRequest(`locations:ward:${provinceId}`, () => fetchAllPages('/locations/', { level: 'ward', parent: provinceId }))
}

export async function getLocationsByIds(ids = []) {
  if (!ids.length) return []
  return fetchAllPages('/locations/', { ids: ids.join(',') })
}
