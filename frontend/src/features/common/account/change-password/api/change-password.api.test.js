import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeCurrentPassword, getPasswordSetupRequirements, sendPasswordSetupCode } from './change-password.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('change password API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    localStorage.clear()
  })

  it('reads whether an emailed code is needed before showing the form', async () => {
    get.mockResolvedValue({
      data: { has_usable_password: false, requires_email_code: true, email_code_ttl_seconds: 600, resend_after_seconds: 0 },
    })

    await expect(getPasswordSetupRequirements()).resolves.toMatchObject({ requires_email_code: true })
    expect(get).toHaveBeenCalledWith('/auth/password/')
  })

  it('asks the backend to email a password setup code', async () => {
    post.mockResolvedValue({ data: { detail: 'sent', resend_after_seconds: 60 } })

    await expect(sendPasswordSetupCode()).resolves.toMatchObject({ resend_after_seconds: 60 })
    expect(post).toHaveBeenCalledWith('/auth/password/setup-code/')
  })

  it('relies on the HttpOnly refresh cookie instead of exposing refresh in the payload', async () => {
    post.mockResolvedValue({ data: { detail: 'ok', user: { has_usable_password: true } } })
    const payload = { password: 'Password@123', logout_all_sessions: false }

    await expect(changeCurrentPassword(payload)).resolves.toMatchObject({ detail: 'ok' })
    expect(post).toHaveBeenCalledWith('/auth/password/', payload)
  })
})
