import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentSessionUser } from './session.api'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  dedupeRequest: vi.fn((_, request) => request()),
  getAccessToken: vi.fn(),
  setTokens: vi.fn(),
  getCurrentPortal: vi.fn(() => 'main'),
}))

vi.mock('@/shared/api/client', () => ({ default: { get: mocks.get, post: mocks.post } }))
vi.mock('@/shared/api/request-deduplication', () => ({ dedupeRequest: mocks.dedupeRequest }))
vi.mock('@/shared/api/token-store', () => ({
  getAccessToken: mocks.getAccessToken,
  setTokens: mocks.setTokens,
}))
vi.mock('@/shared/config/portals', () => ({ getCurrentPortal: mocks.getCurrentPortal }))

describe('session API', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockClear()))

  it('gets the current user under a token-specific deduplication key', async () => {
    mocks.getAccessToken.mockReturnValue('access-token')
    mocks.get.mockResolvedValue({ data: { public_id: 'candidate-1' } })

    await expect(getCurrentSessionUser()).resolves.toEqual({ public_id: 'candidate-1' })
    expect(mocks.dedupeRequest).toHaveBeenCalledWith('session-me:access-token', expect.any(Function))
    expect(mocks.get).toHaveBeenCalledWith('/auth/me/')
  })

  it('treats a missing refresh cookie as an anonymous public session without calling me', async () => {
    mocks.getAccessToken.mockReturnValue(null)
    mocks.post.mockResolvedValue({ status: 204, data: '' })

    await expect(getCurrentSessionUser()).resolves.toBeNull()

    expect(mocks.post).toHaveBeenCalledWith(
      '/auth/refresh/',
      { portal: 'main' },
      {
        headers: {
          'X-Auth-Portal': 'main',
          'X-Session-Probe': '1',
        },
      },
    )
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.setTokens).not.toHaveBeenCalled()
  })

  it('restores the access token from a valid HttpOnly refresh cookie before loading me', async () => {
    mocks.getAccessToken.mockReturnValue(null)
    mocks.post.mockResolvedValue({ data: { access: 'restored-access' } })
    mocks.get.mockResolvedValue({ data: { public_id: 'candidate-1' } })

    await expect(getCurrentSessionUser()).resolves.toEqual({ public_id: 'candidate-1' })

    expect(mocks.setTokens).toHaveBeenCalledWith({ access: 'restored-access' }, 'main')
    expect(mocks.get).toHaveBeenCalledWith('/auth/me/')
  })
})
