import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({
  default: { post },
}))

import { resendTwoFactorLogin, verifyTwoFactorLogin } from './two-factor.api'

describe('two-factor API', () => {
  beforeEach(() => {
    post.mockReset()
    localStorage.clear()
    window.history.replaceState({}, '', '/tuyendung/app/login')
  })

  it('stores tokens in the portal that completed the 2FA challenge', async () => {
    post.mockResolvedValue({ data: { access: 'access-token', refresh: 'refresh-token' } })

    await verifyTwoFactorLogin({ challenge: 'challenge-id', code: '123456', portal: 'employer' })

    expect(post).toHaveBeenCalledWith('/auth/two-factor/login/verify/', { challenge: 'challenge-id', code: '123456' })
    expect(localStorage.getItem('employer_access_token')).toBe('access-token')
    expect(localStorage.getItem('employer_refresh_token')).toBe('refresh-token')
  })

  it('keeps the resend endpoint and payload unchanged', async () => {
    post.mockResolvedValue({ data: { expires_in: 180 } })

    await expect(resendTwoFactorLogin('challenge-id')).resolves.toEqual({ expires_in: 180 })
    expect(post).toHaveBeenCalledWith('/auth/two-factor/login/resend/', { challenge: 'challenge-id' })
  })
})
