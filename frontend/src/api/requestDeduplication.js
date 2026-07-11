// React Strict Mode intentionally re-runs effects in development.  Keep one
// in-flight GET per resource so that it cannot duplicate network traffic or
// side effects such as a job-detail view counter.
const inFlight = new Map()

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
