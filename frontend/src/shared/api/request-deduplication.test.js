import { describe, expect, it, vi } from 'vitest'
import { cachedRequest, dedupeRequest, invalidateRequestCache } from './request-deduplication'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('request deduplication', () => {
  it('shares one in-flight request and allows a later request after it resolves', async () => {
    const pending = deferred()
    const request = vi.fn(() => pending.promise)
    const first = dedupeRequest('in-flight', request)
    const second = dedupeRequest('in-flight', request)

    expect(second).toBe(first)
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)
    pending.resolve({ ok: true })
    await first

    await dedupeRequest('in-flight', request)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('cleans up a rejected request so it can be retried', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true })

    await expect(dedupeRequest('rejected', request)).rejects.toThrow('network error')
    await expect(dedupeRequest('rejected', request)).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('uses a cached value until the cache is invalidated', async () => {
    const request = vi.fn().mockResolvedValue({ version: 1 })

    await expect(cachedRequest('catalogue', 60_000, request)).resolves.toEqual({ version: 1 })
    await expect(cachedRequest('catalogue', 60_000, request)).resolves.toEqual({ version: 1 })
    expect(request).toHaveBeenCalledTimes(1)

    invalidateRequestCache('catalogue')
    await cachedRequest('catalogue', 60_000, request)
    expect(request).toHaveBeenCalledTimes(2)
  })
})
