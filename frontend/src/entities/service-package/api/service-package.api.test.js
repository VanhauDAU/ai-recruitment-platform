import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from '@/shared/api/client'
import {
  getAdminServiceActivations,
  getAdminServiceActivationSummary,
  getEmployerActiveServices,
  getEmployerServiceHistory,
  terminateAdminServiceActivation,
} from './service-package.api'

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('service package operational API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.get.mockResolvedValue({ data: {} })
    client.post.mockResolvedValue({ data: {} })
  })

  it('keeps the admin activation list, summary and termination contracts', async () => {
    const list = { count: 1, results: [{ public_id: 'jsa_1' }] }
    const summary = { active_total: 1, metrics: { views: 20 } }
    const terminated = { public_id: 'jsa_1', status: 'terminated' }
    client.get
      .mockResolvedValueOnce({ data: list })
      .mockResolvedValueOnce({ data: summary })
    client.post.mockResolvedValueOnce({ data: terminated })

    await expect(getAdminServiceActivations({ status: 'active', page: 2 }))
      .resolves.toBe(list)
    await expect(getAdminServiceActivationSummary({ company_public_id: 'co_1' }))
      .resolves.toBe(summary)
    await expect(terminateAdminServiceActivation('jsa_1', 'Dừng theo yêu cầu hợp lệ'))
      .resolves.toBe(terminated)

    expect(client.get).toHaveBeenNthCalledWith(1, '/services/admin/activations/', {
      params: { status: 'active', page: 2 },
    })
    expect(client.get).toHaveBeenNthCalledWith(2, '/services/admin/activations/summary/', {
      params: { company_public_id: 'co_1' },
    })
    expect(client.post).toHaveBeenCalledWith(
      '/services/admin/activations/jsa_1/terminate/',
      { reason: 'Dừng theo yêu cầu hợp lệ' },
    )
  })

  it('accepts both the legacy job id and an activation scope object', async () => {
    client.get
      .mockResolvedValueOnce({ data: [{ public_id: 'jsa_job' }] })
      .mockResolvedValueOnce({ data: [{ public_id: 'jsa_campaign' }] })

    await expect(getEmployerActiveServices('job_1')).resolves.toEqual([
      { public_id: 'jsa_job' },
    ])
    await expect(getEmployerActiveServices({ campaign_public_id: 'camp_1' }))
      .resolves.toEqual([{ public_id: 'jsa_campaign' }])

    expect(client.get).toHaveBeenNthCalledWith(1, '/services/mine/activations/', {
      params: { job_public_id: 'job_1' },
    })
    expect(client.get).toHaveBeenNthCalledWith(2, '/services/mine/activations/', {
      params: { campaign_public_id: 'camp_1' },
    })
  })

  it('preserves employer activation-history pagination', async () => {
    const response = {
      count: 24,
      next: 'next-page',
      results: [{ public_id: 'jsa_1', status: 'expired' }],
    }
    client.get.mockResolvedValueOnce({ data: response })

    await expect(getEmployerServiceHistory({ page: 2, status: 'expired' }))
      .resolves.toBe(response)
    expect(client.get).toHaveBeenCalledWith('/services/mine/activation-history/', {
      params: { page: 2, status: 'expired' },
    })
  })
})
