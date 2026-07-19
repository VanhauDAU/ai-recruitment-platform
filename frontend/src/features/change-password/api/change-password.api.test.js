import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeCurrentPassword } from './change-password.api'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

describe('change password API', () => {
  beforeEach(() => {
    post.mockReset()
    localStorage.clear()
  })

  it('relies on the HttpOnly refresh cookie instead of exposing refresh in the payload', async () => {
    post.mockResolvedValue({ data: { detail: 'ok', user: { has_usable_password: true } } })
    const payload = { password: 'Password@123', logout_all_sessions: false }

    await expect(changeCurrentPassword(payload)).resolves.toMatchObject({ detail: 'ok' })
    expect(post).toHaveBeenCalledWith('/auth/password/', payload)
  })
})
