import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEmployerDashboard } from './employer-dashboard.api'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get } }))

describe('employer dashboard API', () => {
  beforeEach(() => get.mockReset())

  it('loads the cross-domain employer read model', async () => {
    get.mockResolvedValue({ data: { summary: { jobs_active: 2 } } })

    await expect(getEmployerDashboard()).resolves.toEqual({ summary: { jobs_active: 2 } })
    expect(get).toHaveBeenCalledWith('/dashboard/employer/')
  })
})
