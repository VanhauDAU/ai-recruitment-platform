import { fetchAllPages } from './pagination'

export async function getProvinces() {
  return fetchAllPages('/locations/', { level: 'province' })
}

export async function getWards(provinceId) {
  return fetchAllPages('/locations/', { level: 'ward', parent: provinceId })
}
