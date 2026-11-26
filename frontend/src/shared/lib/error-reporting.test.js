import { describe, expect, it, vi } from 'vitest'
import { IGNORED_ERRORS, initErrorReporting, scrubEvent } from './error-reporting'

describe('initErrorReporting', () => {
  it('does nothing without a DSN', () => {
    const loadSdk = vi.fn()
    expect(initErrorReporting({ dsn: '', loadSdk, schedule: (cb) => cb() })).toBe(false)
    expect(loadSdk).not.toHaveBeenCalled()
  })

  it('loads the SDK lazily and initialises it without PII', async () => {
    const init = vi.fn()
    const loadSdk = vi.fn(() => Promise.resolve({ init }))
    let scheduled
    initErrorReporting({
      dsn: 'https://key@example.ingest.sentry.io/1',
      environment: 'staging',
      loadSdk,
      schedule: (cb) => {
        scheduled = cb
      },
    })

    expect(loadSdk).not.toHaveBeenCalled()
    scheduled()
    await vi.waitFor(() => expect(init).toHaveBeenCalledTimes(1))
    expect(init.mock.calls[0][0]).toMatchObject({
      dsn: 'https://key@example.ingest.sentry.io/1',
      environment: 'staging',
      sendDefaultPii: false,
      ignoreErrors: IGNORED_ERRORS,
      beforeSend: scrubEvent,
    })
  })

  it('ignores errors thrown by scripts that in-app browsers inject', () => {
    const ignored = (message) => IGNORED_ERRORS.some((pattern) => pattern.test(message))
    expect(ignored("ReferenceError: Can't find variable: zaloJSV2")).toBe(true)
    expect(ignored('ReferenceError: zaloJSV2 is not defined')).toBe(true)
    expect(ignored("TypeError: Cannot read properties of undefined (reading 'title')")).toBe(false)
  })
})

describe('scrubEvent', () => {
  it('strips query strings, cookies and bodies', () => {
    const event = scrubEvent({
      request: {
        url: 'https://procv.site/reset-password?token=abc#x',
        cookies: { sessionid: 'x' },
        data: { password: 'secret' },
        query_string: 'token=abc',
      },
      breadcrumbs: [{ category: 'navigation', data: { from: '/a?code=1', to: '/b?state=2' } }],
    })

    expect(event.request).toEqual({
      url: 'https://procv.site/reset-password',
      query_string: '[Filtered]',
    })
    expect(event.breadcrumbs[0].data).toEqual({ from: '/a', to: '/b' })
  })
})
