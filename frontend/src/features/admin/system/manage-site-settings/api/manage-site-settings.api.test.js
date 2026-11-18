import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateAdminSettings } from './manage-site-settings.api'

const mocks = vi.hoisted(() => ({
  invalidateRequestCache: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({
  default: { patch: mocks.patch },
}))

vi.mock('@/shared/api/request-deduplication', () => ({
  invalidateRequestCache: mocks.invalidateRequestCache,
}))

describe('manage site settings API', () => {
  beforeEach(() => {
    mocks.invalidateRequestCache.mockReset()
    mocks.patch.mockReset()
  })

  it('invalidates public settings after an admin update', async () => {
    const response = {
      updated: ['brand_primary_color'],
      values: { brand_primary_color: '#7c3aed' },
    }
    mocks.patch.mockResolvedValue({ data: response })

    await expect(updateAdminSettings({ brand_primary_color: '#7c3aed' })).resolves.toEqual(response)

    expect(mocks.patch).toHaveBeenCalledWith('/site/admin/settings/', {
      values: { brand_primary_color: '#7c3aed' },
    })
    expect(mocks.invalidateRequestCache).toHaveBeenCalledWith('site-settings')
  })

  it('keeps the public cache when the update fails', async () => {
    mocks.patch.mockRejectedValue(new Error('Update failed'))

    await expect(updateAdminSettings({ brand_primary_color: '#7c3aed' })).rejects.toThrow('Update failed')
    expect(mocks.invalidateRequestCache).not.toHaveBeenCalled()
  })
})
