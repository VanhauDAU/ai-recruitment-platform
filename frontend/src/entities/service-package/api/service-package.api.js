import client from '@/shared/api/client'
import { cachedRequest, invalidateRequestCache } from '@/shared/api/request-deduplication'

const PUBLIC_PACKAGES_CACHE_KEY = 'services:packages:public'
const PUBLIC_PACKAGES_CACHE_TTL = 5 * 60 * 1000

function collection(data) {
  return data?.results || data || []
}

export function getPublicServicePackages() {
  return cachedRequest(PUBLIC_PACKAGES_CACHE_KEY, PUBLIC_PACKAGES_CACHE_TTL, async () => {
    const { data } = await client.get('/services/packages/')
    return collection(data)
  })
}

export async function getAdminServiceCategories() {
  const { data } = await client.get('/services/admin/categories/')
  return collection(data)
}

export async function createAdminServiceCategory(payload) {
  const { data } = await client.post('/services/admin/categories/', payload)
  invalidateRequestCache(PUBLIC_PACKAGES_CACHE_KEY)
  return data
}

export async function updateAdminServiceCategory(id, payload) {
  const { data } = await client.patch(`/services/admin/categories/${id}/`, payload)
  invalidateRequestCache(PUBLIC_PACKAGES_CACHE_KEY)
  return data
}

export async function deleteAdminServiceCategory(id) {
  await client.delete(`/services/admin/categories/${id}/`)
  invalidateRequestCache(PUBLIC_PACKAGES_CACHE_KEY)
}

export async function getAdminServicePackages() {
  const { data } = await client.get('/services/admin/packages/')
  return collection(data)
}

export async function createAdminServicePackage(payload) {
  const { data } = await client.post('/services/admin/packages/', payload)
  invalidateRequestCache(PUBLIC_PACKAGES_CACHE_KEY)
  return data
}

export async function updateAdminServicePackage(id, payload) {
  const { data } = await client.patch(`/services/admin/packages/${id}/`, payload)
  invalidateRequestCache(PUBLIC_PACKAGES_CACHE_KEY)
  return data
}

export async function deleteAdminServicePackage(id) {
  await client.delete(`/services/admin/packages/${id}/`)
  invalidateRequestCache(PUBLIC_PACKAGES_CACHE_KEY)
}

export async function getAdminServiceCapabilities() {
  const { data } = await client.get('/services/admin/capabilities/')
  return collection(data)
}

export async function getAdminPackageVersions(params = {}) {
  const { data } = await client.get('/services/admin/package-versions/', { params })
  return collection(data)
}

export async function createAdminPackageVersion(payload) {
  const { data } = await client.post('/services/admin/package-versions/', payload)
  return data
}

export async function updateAdminPackageVersion(id, payload) {
  const { data } = await client.put(`/services/admin/package-versions/${id}/`, payload)
  return data
}

export async function deleteAdminPackageVersion(id) {
  await client.delete(`/services/admin/package-versions/${id}/`)
}

export async function publishAdminPackageVersion(id) {
  const { data } = await client.post(`/services/admin/package-versions/${id}/publish/`)
  return data
}

export async function getAdminServiceEntitlements(params = {}) {
  const { data } = await client.get('/services/admin/entitlements/', { params })
  return data
}

export async function grantAdminServiceEntitlements(payload) {
  const { data } = await client.post('/services/admin/entitlements/', payload)
  return data
}

export async function revokeAdminServiceEntitlement(publicId, reason) {
  const { data } = await client.post(`/services/admin/entitlements/${publicId}/revoke/`, { reason })
  return data
}

export async function getAdminServiceAudit(params = {}) {
  const { data } = await client.get('/services/admin/audit/', { params })
  return data
}
