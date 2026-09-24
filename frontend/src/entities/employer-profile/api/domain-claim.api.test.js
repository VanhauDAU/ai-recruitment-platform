import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmployerCompanyDomainClaim,
  getEmployerCompanyDomainClaims,
  requestEmployerCompanyDomainManualReview,
  rotateEmployerCompanyDomainClaim,
  verifyEmployerCompanyDomainClaim,
} from './employer-profile.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('employer company domain claim API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset().mockResolvedValue({ data: { public_id: 'dmc_1' } })
  })

  it('uses the employer portal contract and never submits a caller-owned domain', async () => {
    get.mockResolvedValue({ data: { results: [{ public_id: 'dmc_1' }] } })

    await expect(getEmployerCompanyDomainClaims()).resolves.toEqual([{ public_id: 'dmc_1' }])
    await createEmployerCompanyDomainClaim()

    expect(get).toHaveBeenCalledWith('/employer/company/domain-claims/')
    expect(post).toHaveBeenCalledWith('/employer/company/domain-claims/', {})
  })

  it('sends lock versions on rotating and requesting manual review', async () => {
    await verifyEmployerCompanyDomainClaim('dmc /1')
    await rotateEmployerCompanyDomainClaim('dmc_1', 3)
    await requestEmployerCompanyDomainManualReview('dmc_1', {
      lockVersion: 4,
      reason: 'DNS do nhà cung cấp quản lý.',
    })

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/employer/company/domain-claims/dmc%20%2F1/verify/',
      {},
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/employer/company/domain-claims/dmc_1/rotate/',
      { lock_version: 3 },
    )
    expect(post).toHaveBeenNthCalledWith(
      3,
      '/employer/company/domain-claims/dmc_1/request-manual-review/',
      { lock_version: 4, reason: 'DNS do nhà cung cấp quản lý.' },
    )
  })
})
