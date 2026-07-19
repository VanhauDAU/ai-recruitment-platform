import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeCurrentPassword } from './change-password.api'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

describe('change password API', () => {
  beforeEach(() => {
    post.mockReset()
    localStorage.clear()
  })

  it('posts the authenticated password contract with the current refresh token', async () => {
    localStorage.setItem('main_refresh_token', 'current-refresh')
    post.mockResolvedValue({ data: { detail: 'ok', user: { has_usable_password: true } } })
    const payload = { password: 'Password@123', logout_all_sessions: false }

    await expect(changeCurrentPassword(payload)).resolves.toMatchObject({ detail: 'ok' })
    expect(post).toHaveBeenCalledWith('/auth/password/', { ...payload, refresh: 'current-refresh' })
  })
})
