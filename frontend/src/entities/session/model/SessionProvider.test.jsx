import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionProvider from './SessionProvider'
import { useSession } from './useSession'
const { getCurrentSessionUser } = vi.hoisted(() => ({ getCurrentSessionUser: vi.fn() }))

vi.mock('../api/session.api', () => ({ getCurrentSessionUser }))

function wrapper({ children }) {
  return <MemoryRouter initialEntries={['/tai-khoan']}><SessionProvider>{children}</SessionProvider></MemoryRouter>
}

describe('SessionProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    getCurrentSessionUser.mockReset()
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
    getCurrentSessionUser.mockRejectedValue(new Error('unauthorized'))

    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('main_access_token')).toBeNull()
    expect(localStorage.getItem('main_refresh_token')).toBeNull()
  })

  it('logs out by clearing tokens and user state', async () => {
    localStorage.setItem('main_access_token', 'access-token')
    getCurrentSessionUser.mockResolvedValue({ public_id: 'candidate-1', role: 'candidate' })
    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    act(() => result.current.logout())

    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('main_access_token')).toBeNull()
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
