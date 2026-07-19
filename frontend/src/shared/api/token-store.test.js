import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllPortalSessions,
  clearCurrentPortalSession,
  clearTokens,
  getAccessToken,
  setTokens,
  subscribeToSessionLogout,
} from './token-store'

// jsdom mở tại path '/', nên getCurrentPortal() trả về 'main'.
const MAIN_COOKIE = 'procv_auth_logout_main'
const EMPLOYER_COOKIE = 'procv_auth_logout_employer'

function clearCookie(name) {
  document.cookie = `${name}=; Path=/; Max-Age=0`
}

describe('portal token store', () => {
  beforeEach(() => {
    localStorage.clear()
    clearCookie(MAIN_COOKIE)
    clearCookie(EMPLOYER_COOKIE)
  })

  afterEach(() => {
    vi.useRealTimers()
    clearCookie(MAIN_COOKIE)
    clearCookie(EMPLOYER_COOKIE)
  })

  it('logs out only the requested portal, leaving other portals signed in', () => {
    setTokens({ access: 'candidate-access', refresh: 'candidate-refresh' }, 'main')
    setTokens({ access: 'employer-access', refresh: 'employer-refresh' }, 'employer')

    clearCurrentPortalSession('main')

    expect(getAccessToken('main')).toBeNull()
    expect(getAccessToken('employer')).toBe('employer-access')
  })

  it('clears every portal on an explicit whole-device logout', () => {
    setTokens({ access: 'candidate-access', refresh: 'candidate-refresh' }, 'main')
    setTokens({ access: 'employer-access', refresh: 'employer-refresh' }, 'employer')

    clearAllPortalSessions()

    expect(getAccessToken('main')).toBeNull()
    expect(getAccessToken('employer')).toBeNull()
  })

  it('drops only the current portal tokens when its refresh fails locally', () => {
    setTokens({ access: 'candidate-access', refresh: 'candidate-refresh' }, 'main')
    setTokens({ access: 'employer-access', refresh: 'employer-refresh' }, 'employer')

    clearTokens('main')

    expect(getAccessToken('main')).toBeNull()
    expect(getAccessToken('employer')).toBe('employer-access')
  })

  it('reacts only to the current portal marker changed by another subdomain', () => {
    vi.useFakeTimers()
    setTokens({ access: 'candidate-access', refresh: 'candidate-refresh' }, 'main')
    setTokens({ access: 'employer-access', refresh: 'employer-refresh' }, 'employer')
    const onLogout = vi.fn()
    const unsubscribe = subscribeToSessionLogout(onLogout)

    // Marker của cổng NTD đổi không được đụng phiên cổng ứng viên hiện tại.
    document.cookie = `${EMPLOYER_COOKIE}=logout-employer; Path=/; SameSite=Lax`
    vi.advanceTimersByTime(1000)
    expect(getAccessToken('main')).toBe('candidate-access')
    expect(onLogout).not.toHaveBeenCalled()

    // Marker của chính cổng ứng viên đổi thì xóa phiên ứng viên trên tab này.
    document.cookie = `${MAIN_COOKIE}=logout-main; Path=/; SameSite=Lax`
    vi.advanceTimersByTime(1000)
    expect(getAccessToken('main')).toBeNull()
    expect(onLogout).toHaveBeenCalledOnce()

    unsubscribe()
  })
})
