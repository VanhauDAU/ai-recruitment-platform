import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changeAdminEmployerVerificationLifecycle,
  decideAdminEmployerVerification,
  getAdminEmployerDecisionImpact,
  getAdminEmployerLifecycleImpact,
  unlockAdminEmployerVerificationResubmission,
} from './admin-employer-verification.api'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

describe('admin employer verification API', () => {
  beforeEach(() => post.mockReset())

  it('keeps final decision preview and confirm as separate endpoints', async () => {
    const preview = { decision: 'approved', tax_override: false }
    const confirm = { ...preview, impact_token: 'signed-impact' }
    post
      .mockResolvedValueOnce({ data: { impact_token: 'signed-impact' } })
      .mockResolvedValueOnce({ data: { status: 'approved' } })

    await getAdminEmployerDecisionImpact('evc_1', preview)
    await decideAdminEmployerVerification('evc_1', confirm)

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/admin/employer-verifications/evc_1/decision-impact/',
      preview,
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/admin/employer-verifications/evc_1/decision/',
      confirm,
    )
  })

  it.each([
    ['revoked', 'revoke'],
    ['expired', 'expire'],
  ])('maps %s to allowlisted lifecycle endpoints', async (action, path) => {
    post.mockResolvedValue({ data: { status: action } })
    const preview = { reason: 'Lý do tuân thủ' }
    const confirm = { ...preview, impact_token: 'signed-impact' }

    await getAdminEmployerLifecycleImpact('evc_1', action, preview)
    await changeAdminEmployerVerificationLifecycle('evc_1', action, confirm)

    expect(post).toHaveBeenNthCalledWith(
      1,
      `/admin/employer-verifications/evc_1/${path}-impact/`,
      preview,
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/admin/employer-verifications/evc_1/${path}/`,
      confirm,
    )
  })

  it('rejects lifecycle actions outside the frontend allowlist', async () => {
    expect(() => (
      getAdminEmployerLifecycleImpact('evc_1', 'approved', { reason: 'No' })
    )).toThrow('Unsupported employer verification lifecycle action.')
    expect(post).not.toHaveBeenCalled()
  })

  it('posts a bounded audited resubmission unlock request', async () => {
    post.mockResolvedValue({ data: { resubmission_locked: false } })
    const payload = { reason: 'Đã đối chiếu khiếu nại', lock_version: 7 }

    await unlockAdminEmployerVerificationResubmission('evc_1', payload)

    expect(post).toHaveBeenCalledWith(
      '/admin/employer-verifications/evc_1/unlock-resubmission/',
      payload,
    )
  })
})
