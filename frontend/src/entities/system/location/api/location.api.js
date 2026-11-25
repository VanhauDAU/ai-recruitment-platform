import api from '@/shared/api/client'
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

// Tra vị trí cho "Việc làm gần tôi" (ADR-0029): phường/xã có sẵn tâm + gợi ý của
// nhà cung cấp bản đồ (qua backend, không lộ key). Tọa độ chỉ để xếp gợi ý gần.
export async function searchGeoPlaces(query, focus, { signal } = {}) {
  const params = { q: query }
  if (focus) Object.assign(params, { lat: focus.latitude, lng: focus.longitude })
  const { data } = await api.get('/public/locations/geo/autocomplete/', { params, signal })
  return data
}

export async function resolveGeoPlace(ref) {
  const { data } = await api.get('/public/locations/geo/place/', { params: { ref } })
  return data
}


export async function getGeoWard(slug) {
  const { data } = await api.get(`/public/locations/geo/wards/${encodeURIComponent(slug)}/`)
  return data
}
