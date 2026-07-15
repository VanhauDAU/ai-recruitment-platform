import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentSessionUser } from './session.api'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  dedupeRequest: vi.fn((_, request) => request()),
  getAccessToken: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get: mocks.get } }))
vi.mock('@/shared/api/request-deduplication', () => ({ dedupeRequest: mocks.dedupeRequest }))
vi.mock('../model/session.storage', () => ({ getAccessToken: mocks.getAccessToken }))

describe('session API', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockClear()))

  it('gets the current user under a token-specific deduplication key', async () => {
    mocks.getAccessToken.mockReturnValue('access-token')
    mocks.get.mockResolvedValue({ data: { public_id: 'candidate-1' } })

    await expect(getCurrentSessionUser()).resolves.toEqual({ public_id: 'candidate-1' })
    expect(mocks.dedupeRequest).toHaveBeenCalledWith('session-me:access-token', expect.any(Function))
    expect(mocks.get).toHaveBeenCalledWith('/auth/me/')
  })
})
