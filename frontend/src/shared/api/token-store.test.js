import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  clearTokens,
  getAccessToken,
  setTokens,
  subscribeToSessionLogout,
} from './token-store'

const LOGOUT_COOKIE_NAME = 'procv_auth_logout'

function clearLogoutCookie() {
  document.cookie = `${LOGOUT_COOKIE_NAME}=; Path=/; Max-Age=0`
}

describe('portal token store', () => {
  beforeEach(() => {
    localStorage.clear()
    clearLogoutCookie()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearLogoutCookie()
  })

  it('keeps portal sessions independent until an explicit global logout', () => {
    setTokens({ access: 'candidate-access', refresh: 'candidate-refresh' }, 'main')
    setTokens({ access: 'employer-access', refresh: 'employer-refresh' }, 'employer')

    clearTokens('main')

    expect(getAccessToken('main')).toBeNull()
    expect(getAccessToken('employer')).toBe('employer-access')

    clearSession()

    expect(getAccessToken('employer')).toBeNull()
  })

  it('clears local tokens when another subdomain changes the logout marker', () => {
    vi.useFakeTimers()
    setTokens({ access: 'employer-access', refresh: 'employer-refresh' }, 'employer')
    const onLogout = vi.fn()
    const unsubscribe = subscribeToSessionLogout(onLogout)

    document.cookie = `${LOGOUT_COOKIE_NAME}=logout-from-main; Path=/; SameSite=Lax`
    vi.advanceTimersByTime(1000)

    expect(getAccessToken('employer')).toBeNull()
    expect(onLogout).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
