import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptAdminInvitation,
  changeAccountStatus,
  createAdminInvitation,
  getAdminAccounts,
  getAdminAccountSummary,
  getAccountResourceHoldImpact,
  getAvailableAdminInvitationRoles,
  getProvisioningScopeImpact,
  resendAdminInvitation,
  releaseAccountResourceHolds,
  revokeAccountSessions,
  setProvisioningScopeStatus,
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
      mfa: 'true',
      department: 'dept_people',
      admin_role: 'arole_hr',
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

  it('never derives invitation roles locally and posts the selected public id', async () => {
    await getAvailableAdminInvitationRoles({ signal: 'signal' })
    await createAdminInvitation({
      email: 'admin@example.com',
      full_name: 'Admin mới',
      target_role_public_id: 'arole_moderator',
      reason: 'Bổ sung ca tối',
    })
    expect(get).toHaveBeenCalledWith(
      '/admin/account-invitations/available-roles/',
      { signal: 'signal' },
    )
    expect(post).toHaveBeenCalledWith('/admin/account-invitations/', {
      email: 'admin@example.com',
      full_name: 'Admin mới',
      target_role_public_id: 'arole_moderator',
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
    await getProvisioningScopeImpact('apscope_1', false)
    await setProvisioningScopeStatus('apscope_1', false, 'impact-scope')

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
    expect(post).toHaveBeenNthCalledWith(
      5,
      '/admin/provisioning-scopes/apscope_1/status-impact/',
      { is_active: false },
    )
    expect(post).toHaveBeenNthCalledWith(
      6,
      '/admin/provisioning-scopes/apscope_1/deactivate/',
      { impact_token: 'impact-scope' },
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
