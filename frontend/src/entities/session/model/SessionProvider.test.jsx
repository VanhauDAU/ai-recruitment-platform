import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import SessionProvider from './SessionProvider'
import { useSession } from './use-session'
const { getCurrentSessionUser, logoutCurrentPortal, logoutAllDevices } = vi.hoisted(() => ({
  getCurrentSessionUser: vi.fn(),
  logoutCurrentPortal: vi.fn(),
  logoutAllDevices: vi.fn(),
}))

vi.mock('../api/session.api', () => ({ getCurrentSessionUser, logoutCurrentPortal, logoutAllDevices }))

function wrapper({ children }) {
  return withQueryClient(
    <MemoryRouter initialEntries={['/tai-khoan']}><SessionProvider>{children}</SessionProvider></MemoryRouter>,
  )
}

describe('SessionProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    getCurrentSessionUser.mockReset()
    logoutCurrentPortal.mockReset().mockResolvedValue(undefined)
    logoutAllDevices.mockReset().mockResolvedValue(undefined)
  })

  it('restores a valid session from persisted tokens', async () => {
    localStorage.setItem('main_access_token', 'access-token')
    getCurrentSessionUser.mockResolvedValue({ public_id: 'candidate-1', role: 'candidate' })

    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual({ public_id: 'candidate-1', role: 'candidate' })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('clears an invalid persisted session', async () => {
    localStorage.setItem('main_access_token', 'expired-access')
    localStorage.setItem('main_refresh_token', 'expired-refresh')
    localStorage.setItem('employer_access_token', 'valid-employer-access')
    localStorage.setItem('employer_refresh_token', 'valid-employer-refresh')
    getCurrentSessionUser.mockRejectedValue(new Error('unauthorized'))

    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('main_access_token')).toBeNull()
    expect(localStorage.getItem('main_refresh_token')).toBeNull()
    expect(localStorage.getItem('employer_access_token')).toBe('valid-employer-access')
    expect(localStorage.getItem('employer_refresh_token')).toBe('valid-employer-refresh')
  })

  it('logs out only the current portal and blacklists its refresh token', async () => {
    localStorage.setItem('main_access_token', 'access-token')
    localStorage.setItem('main_refresh_token', 'refresh-token')
    localStorage.setItem('employer_access_token', 'employer-access')
    localStorage.setItem('employer_refresh_token', 'employer-refresh')
    localStorage.setItem('admin_access_token', 'admin-access')
    getCurrentSessionUser.mockResolvedValue({ public_id: 'candidate-1', role: 'candidate' })
    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    await act(async () => { await result.current.logout() })

    expect(logoutCurrentPortal).toHaveBeenCalledWith('refresh-token')
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('main_access_token')).toBeNull()
    expect(localStorage.getItem('main_refresh_token')).toBeNull()
    // Cổng khác trên cùng thiết bị vẫn đăng nhập.
    expect(localStorage.getItem('employer_access_token')).toBe('employer-access')
    expect(localStorage.getItem('admin_access_token')).toBe('admin-access')
  })

  it('logs out every portal on the device when logging out everywhere', async () => {
    localStorage.setItem('main_access_token', 'access-token')
    localStorage.setItem('main_refresh_token', 'main-refresh')
    localStorage.setItem('employer_access_token', 'employer-access')
    localStorage.setItem('employer_refresh_token', 'employer-refresh')
    getCurrentSessionUser.mockResolvedValue({ public_id: 'candidate-1', role: 'candidate' })
    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    await act(async () => { await result.current.logoutEverywhere() })

    expect(logoutCurrentPortal).toHaveBeenCalledWith('main-refresh')
    expect(logoutCurrentPortal).toHaveBeenCalledWith('employer-refresh')
    expect(localStorage.getItem('main_access_token')).toBeNull()
    expect(localStorage.getItem('employer_access_token')).toBeNull()
  })

  it('clears the session when refreshSession fails', async () => {
    localStorage.setItem('main_access_token', 'access-token')
    getCurrentSessionUser
      .mockResolvedValueOnce({ public_id: 'candidate-1', role: 'candidate' })
      .mockRejectedValueOnce(new Error('refresh failed'))
    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    await act(async () => {
      await expect(result.current.refreshSession()).rejects.toThrow('refresh failed')
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('main_access_token')).toBeNull()
  })
})
