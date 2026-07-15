// React Strict Mode intentionally re-runs effects in development.  Keep one
// in-flight GET per resource so that it cannot duplicate network traffic or
// side effects such as a job-detail view counter.
//
// Phạm vi còn lại sau khi TanStack Query đảm nhiệm server-state (FE-P5):
// chỉ các API được gọi NGOÀI react-query — bootstrap context (site-settings,
// session, locale) và catalogue đọc trực tiếp từ api layer (blog, location,
// job categories/stats). Endpoint nào chuyển hẳn sang useQuery thì bỏ wrapper
// tại api layer (xem saved-jobs.api.js).
const inFlight = new Map()
const cache = new Map()

export function dedupeRequest(key, request) {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = Promise.resolve().then(request)
  inFlight.set(key, promise)
  promise.then(
    () => inFlight.delete(key),
    () => inFlight.delete(key),
  )
  return promise
}

// Cache slow-changing public catalogues across components and routes.  This is
// deliberately separate from `dedupeRequest`: dynamic job searches continue
// to hit the API, while shared metadata is reused for a short, explicit TTL.
export function cachedRequest(key, ttlMs, request) {
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)

  return dedupeRequest(key, request).then((value) => {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs })
    return value
  })
}

export function invalidateRequestCache(key) {
  cache.delete(key)
}
