import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({
  default: {
    post,
    get,
    defaults: { baseURL: 'http://localhost:8000/api' },
  },
}))

import {
  changeEmail,
  checkRegistrationEmail,
  completeOAuth,
  confirmPasswordReset,
  confirmVerification,
  login,
  logout,
  oauthStartUrl,
  register,
  requestPasswordReset,
  resendTwoFactorLogin,
  sendVerificationEmail,
  validatePasswordResetToken,
  verifyTwoFactorLogin,
} from './auth.api'

describe('auth API session storage', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    window.history.replaceState({}, '', '/login')
  })

  it('stores tokens in the portal-specific namespace after login', async () => {
    post.mockResolvedValue({ data: { access: 'access-token', refresh: 'refresh-token' } })

    await login({ email: 'user@example.com', password: 'secret', captcha_token: 'captcha', portal: 'employer' })

    expect(localStorage.getItem('employer_access_token')).toBe('access-token')
    expect(localStorage.getItem('employer_refresh_token')).toBe('refresh-token')
  })

  it('checks email availability through the registration API', async () => {
    post.mockResolvedValue({ data: { available: false } })

    await expect(checkRegistrationEmail('used@example.com')).resolves.toBe(false)
    expect(post).toHaveBeenCalledWith('/auth/register/email-availability/', { email: 'used@example.com' }, { signal: undefined })
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

  it('stores tokens in the portal that completed the 2FA login challenge', async () => {
    post.mockResolvedValue({ data: { access: 'access-token', refresh: 'refresh-token' } })

    await verifyTwoFactorLogin({ challenge: 'challenge-id', code: '123456', portal: 'employer' })

    expect(post).toHaveBeenCalledWith('/auth/two-factor/login/verify/', { challenge: 'challenge-id', code: '123456' })
    expect(localStorage.getItem('employer_access_token')).toBe('access-token')
    expect(localStorage.getItem('employer_refresh_token')).toBe('refresh-token')
  })

  it('keeps the 2FA resend endpoint and payload unchanged', async () => {
    post.mockResolvedValue({ data: { expires_in: 180 } })

    await expect(resendTwoFactorLogin('challenge-id')).resolves.toEqual({ expires_in: 180 })
    expect(post).toHaveBeenCalledWith('/auth/two-factor/login/resend/', { challenge: 'challenge-id' })
  })

  it('keeps email verification and password reset endpoint contracts', async () => {
    post.mockResolvedValue({ data: { ok: true } })
    get.mockResolvedValue({ data: { valid: true } })

    await sendVerificationEmail()
    await confirmVerification('verify-token')
    await changeEmail('new@example.com')
    await requestPasswordReset({ email: 'user@example.com', captcha_token: 'captcha' })
    await validatePasswordResetToken('reset-token')
    await confirmPasswordReset({ token: 'reset-token', password: 'Abc123' })

    expect(post).toHaveBeenCalledWith('/auth/verify/send/')
    expect(post).toHaveBeenCalledWith('/auth/verify/confirm/', { token: 'verify-token' })
    expect(post).toHaveBeenCalledWith('/auth/change-email/', { email: 'new@example.com' })
    expect(post).toHaveBeenCalledWith('/auth/password-reset/', { email: 'user@example.com', captcha_token: 'captcha' })
    expect(get).toHaveBeenCalledWith('/auth/password-reset/validate/', { params: { token: 'reset-token' } })
    expect(post).toHaveBeenCalledWith('/auth/password-reset/confirm/', { token: 'reset-token', password: 'Abc123' })
  })

  it('builds OAuth URLs and persists OAuth tokens for the requested portal', async () => {
    post.mockResolvedValue({ data: { access: 'access-token', refresh: 'refresh-token' } })

    expect(oauthStartUrl('google', { portal: 'employer', next: '/tuyendung/app/dashboard' }))
      .toBe('http://localhost:8000/api/auth/oauth/google/start/?portal=employer&next=%2Ftuyendung%2Fapp%2Fdashboard')
    await completeOAuth('one-time-code', 'admin')

    expect(post).toHaveBeenCalledWith('/auth/oauth/complete/', { code: 'one-time-code' })
    expect(localStorage.getItem('admin_access_token')).toBe('access-token')
  })
})
