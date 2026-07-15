import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateProfile } from './edit-profile.api'
const { patch } = vi.hoisted(() => ({ patch: vi.fn() }))

vi.mock('@/shared/api/client', () => ({
  default: { patch },
}))

describe('account API', () => {
  beforeEach(() => patch.mockReset())

  it('updates only the editable profile fields through the existing endpoint', async () => {
    const updatedUser = { id: 1, full_name: 'Nguyễn An', phone: '0912345678' }
    patch.mockResolvedValue({ data: updatedUser })

    await expect(updateProfile({ full_name: 'Nguyễn An', phone: '0912345678' })).resolves.toEqual(updatedUser)
    expect(patch).toHaveBeenCalledWith('/auth/me/', { full_name: 'Nguyễn An', phone: '0912345678' })
  })
})
