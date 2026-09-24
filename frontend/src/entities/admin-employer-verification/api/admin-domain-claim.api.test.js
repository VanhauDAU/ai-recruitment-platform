import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decideAdminCompanyDomainClaim,
  getAdminCompanyDomainClaim,
  getAdminCompanyDomainClaimImpact,
  getAdminCompanyDomainClaims,
  getAdminCompanyDomainClaimSummary,
} from './admin-employer-verification.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('admin company domain claim API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { count: 0, results: [] } })
    post.mockReset().mockResolvedValue({ data: { status: 'verified' } })
  })

  it('keeps list ordering authoritative on the server', async () => {
    const params = { status: 'pending', page: 2 }
    await getAdminCompanyDomainClaims(params, { signal: 'signal' })
    expect(get).toHaveBeenCalledWith('/admin/company-domain-claims/', {
      params,
      signal: 'signal',
    })
  })

  it('loads summary and detail from dedicated read endpoints', async () => {
    await getAdminCompanyDomainClaimSummary({ signal: 'summary-signal' })
    await getAdminCompanyDomainClaim('dmc /1', { signal: 'detail-signal' })

    expect(get).toHaveBeenNthCalledWith(1, '/admin/company-domain-claims/summary/', {
      signal: 'summary-signal',
    })
    expect(get).toHaveBeenNthCalledWith(2, '/admin/company-domain-claims/dmc%20%2F1/', {
      signal: 'detail-signal',
    })
  })

  it('uses a signed impact preview before approving manual review', async () => {
    await getAdminCompanyDomainClaimImpact('dmc /1', 'approve_manual', 'Đã đối chiếu hồ sơ.')
    await decideAdminCompanyDomainClaim('dmc /1', {
      action: 'approve_manual',
      reason: 'Đã đối chiếu hồ sơ.',
      impactToken: 'signed',
    })

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/admin/company-domain-claims/dmc%20%2F1/manual-review-impact/',
      { decision: 'approve_manual', reason: 'Đã đối chiếu hồ sơ.' },
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/admin/company-domain-claims/dmc%20%2F1/approve-manual/',
      { reason: 'Đã đối chiếu hồ sơ.', impact_token: 'signed' },
    )
  })
})
