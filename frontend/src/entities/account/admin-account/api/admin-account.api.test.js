import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptAdminInvitation,
  changeAccountStatus,
  createAdminInvitation,
  getAdminAccounts,
  getAdminAccountSummary,
  getAccountResourceHoldImpact,
  getEmployerCompanyUnlinkImpact,
  resendAdminInvitation,
  releaseAccountResourceHolds,
  revokeAccountSessions,
  unlinkEmployerCompany,
} from './admin-account.api'

const { get, patch, post } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('admin account management API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
    get.mockResolvedValue({ data: {} })
    post.mockResolvedValue({ data: {} })
  })

  it('sends the complete account filter contract to the list endpoint', async () => {
    const params = {
      page: 2,
      q: 'an@example.com',
      role: 'admin',
      status: 'active',
      email_verified: 'true',
      ordering: '-last_login',
    }
    await getAdminAccounts(params, { signal: 'signal' })
    expect(get).toHaveBeenCalledWith('/admin/accounts/', {
      params,
      signal: 'signal',
    })
  })

  it('requests the explicit account summary scope', async () => {
    await getAdminAccountSummary({ scope: 'users' }, { signal: 'signal' })
    expect(get).toHaveBeenCalledWith('/admin/accounts/summary/', {
      params: { scope: 'users' },
      signal: 'signal',
    })
  })

  it('posts an admin invitation without any role assignment', async () => {
    await createAdminInvitation({
      email: 'admin@example.com',
      full_name: 'Admin mới',
      reason: 'Bổ sung ca tối',
    })
    expect(post).toHaveBeenCalledWith('/admin/account-invitations/', {
      email: 'admin@example.com',
      full_name: 'Admin mới',
      reason: 'Bổ sung ca tối',
    })
  })

  it('keeps impact preview and confirm as separate requests', async () => {
    await changeAccountStatus(
      'usr_1',
      { status: 'inactive', reason: 'Điều tra bảo mật' },
      'impact-status',
    )
    await revokeAccountSessions('usr_1', 'Thiết bị thất lạc', 'impact-session')
    await getAccountResourceHoldImpact('usr_1', {
      reason: 'Đã rà soát',
      enforcement_evidence: 'Biên bản rà soát có đủ hơn hai mươi ký tự.',
    })
    await releaseAccountResourceHolds(
      'usr_1',
      {
        reason: 'Đã rà soát',
        enforcement_evidence: 'Biên bản rà soát có đủ hơn hai mươi ký tự.',
      },
      'impact-hold',
    )

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/admin/accounts/usr_1/change-status/',
      {
        status: 'inactive',
        reason: 'Điều tra bảo mật',
        impact_token: 'impact-status',
      },
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/admin/accounts/usr_1/revoke-sessions/',
      {
        reason: 'Thiết bị thất lạc',
        impact_token: 'impact-session',
      },
    )
    expect(post).toHaveBeenNthCalledWith(
      3,
      '/admin/accounts/usr_1/resource-hold-impact/',
      {
        reason: 'Đã rà soát',
        enforcement_evidence: 'Biên bản rà soát có đủ hơn hai mươi ký tự.',
      },
    )
    expect(post).toHaveBeenNthCalledWith(
      4,
      '/admin/accounts/usr_1/release-resource-holds/',
      {
        reason: 'Đã rà soát',
        enforcement_evidence: 'Biên bản rà soát có đủ hơn hai mươi ký tự.',
        impact_token: 'impact-hold',
      },
    )
  })

  it('uses a separate signed preview before employer company unlink', async () => {
    await getEmployerCompanyUnlinkImpact('usr_employer', 'Chọn nhầm công ty')
    await unlinkEmployerCompany('usr_employer', 'Chọn nhầm công ty', 'impact-unlink')

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/admin/accounts/usr_employer/company-unlink-impact/',
      { reason: 'Chọn nhầm công ty' },
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/admin/accounts/usr_employer/unlink-company/',
      { reason: 'Chọn nhầm công ty', impact_token: 'impact-unlink' },
    )
  })

  it('uses versioned server flows for resend and public acceptance', async () => {
    await resendAdminInvitation('ainv_1')
    await acceptAdminInvitation({
      token: 'signed-token',
      password: 'StrongPass123',
      password_confirm: 'StrongPass123',
    })
    expect(post).toHaveBeenNthCalledWith(
      1,
      '/admin/account-invitations/ainv_1/resend/',
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/auth/admin-invitations/accept/',
      {
        token: 'signed-token',
        password: 'StrongPass123',
        password_confirm: 'StrongPass123',
      },
    )
  })
})
