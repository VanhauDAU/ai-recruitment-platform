import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('./api', () => ({
  default: {
    post,
    defaults: { baseURL: 'http://localhost:8000/api' },
  },
}))

import { login, logout, register } from './authService'

describe('authService session storage', () => {
  beforeEach(() => {
    post.mockReset()
    window.history.replaceState({}, '', '/login')
  })

  it('stores tokens in the portal-specific namespace after login', async () => {
    post.mockResolvedValue({ data: { access: 'access-token', refresh: 'refresh-token' } })

    await login({ email: 'user@example.com', password: 'secret', captcha_token: 'captcha', portal: 'employer' })

    expect(localStorage.getItem('employer_access_token')).toBe('access-token')
    expect(localStorage.getItem('employer_refresh_token')).toBe('refresh-token')
  })

  it('clears the complete portal session', async () => {
    localStorage.setItem('main_access_token', 'access-token')
    localStorage.setItem('main_refresh_token', 'refresh-token')

    logout('main')

    expect(localStorage.getItem('main_access_token')).toBeNull()
    expect(localStorage.getItem('main_refresh_token')).toBeNull()
  })

  it('stores registration tokens for the requested portal', async () => {
    post.mockResolvedValue({ data: { access: 'access-token', refresh: 'refresh-token', user: { id: 1 } } })

    await register({
      email: 'user@example.com', password: 'Abc123', role: 'candidate', full_name: 'Candidate', captcha_token: 'captcha', portal: 'main',
    })

    expect(localStorage.getItem('main_access_token')).toBe('access-token')
    expect(localStorage.getItem('main_refresh_token')).toBe('refresh-token')
  })
})
