import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeCurrentPassword, getPasswordSetupRequirements } from './change-password.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('change password API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    localStorage.clear()
  })

  it('reads the reauthentication requirement of the current session before showing the form', async () => {
    get.mockResolvedValue({
      data: { requires_reauth: true, reauth_provider: 'google', reauth_max_age_seconds: 300 },
    })

    await expect(getPasswordSetupRequirements()).resolves.toMatchObject({ requires_reauth: true })
    expect(get).toHaveBeenCalledWith('/auth/password/')
  })

  it('relies on the HttpOnly refresh cookie instead of exposing refresh in the payload', async () => {
    post.mockResolvedValue({ data: { detail: 'ok', user: { has_usable_password: true } } })
    const payload = { password: 'Password@123', logout_all_sessions: false }

    await expect(changeCurrentPassword(payload)).resolves.toMatchObject({ detail: 'ok' })
    expect(post).toHaveBeenCalledWith('/auth/password/', payload)
  })
})
