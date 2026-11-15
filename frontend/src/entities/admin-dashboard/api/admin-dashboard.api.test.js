import { describe, expect, it, vi } from 'vitest'
import api from '@/shared/api/client'
import { adminDashboardKeys, getAdminDashboard, getAdminQueueSummary } from './admin-dashboard.api'

vi.mock('@/shared/api/client', () => ({ default: { get: vi.fn() } }))

describe('admin dashboard api', () => {
  it('requests the selected period and keys the cache by it', async () => {
    const signal = new AbortController().signal
    api.get.mockResolvedValue({ data: { period: { days: 7 } } })

    await expect(getAdminDashboard(7, { signal })).resolves.toEqual({ period: { days: 7 } })
    expect(api.get).toHaveBeenCalledWith('/dashboard/admin/', { params: { period: 7 }, signal })
    expect(adminDashboardKeys.detail(30)).toEqual(['admin-dashboard', 30])
  })

  it('reads the lightweight queue summary for the admin shell', async () => {
    api.get.mockResolvedValue({ data: { queues: [] } })

    await expect(getAdminQueueSummary()).resolves.toEqual({ queues: [] })
    expect(api.get).toHaveBeenLastCalledWith('/dashboard/admin/queues/', { signal: undefined })
  })
})
