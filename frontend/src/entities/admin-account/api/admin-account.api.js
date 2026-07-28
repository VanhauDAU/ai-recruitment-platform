import client from '@/shared/api/client'

async function data(request) {
  const response = await request
  return response.data
}

export function getAdminAccounts(params = {}, { signal } = {}) {
  return data(client.get('/admin/accounts/', { params, signal }))
}

export function getAdminAccountSummary(params = {}, { signal } = {}) {
  return data(client.get('/admin/accounts/summary/', { params, signal }))
}

export function getAdminAccount(publicId, { signal } = {}) {
  return data(client.get(`/admin/accounts/${publicId}/`, { signal }))
}

export function updateAdminAccount(publicId, payload) {
  return data(client.patch(`/admin/accounts/${publicId}/`, payload))
}

export function getAdminAccountProfile(publicId, { reveal = false, signal } = {}) {
  return data(client.get(`/admin/accounts/${publicId}/profile/`, {
    params: reveal ? { reveal: true } : {},
    signal,
  }))
}

export function updateAdminAccountProfile(publicId, payload) {
  return data(client.patch(`/admin/accounts/${publicId}/profile/`, payload))
}

export function getAdminAccountResource(publicId, resource, page = 1, { signal } = {}) {
  return data(client.get(`/admin/accounts/${publicId}/${resource}/`, {
    params: { page },
    signal,
  }))
}

export function getAdminAccountSessions(publicId, { signal } = {}) {
  return data(client.get(`/admin/accounts/${publicId}/sessions/`, { signal }))
}

export function getAdminAccountActivity(publicId, page = 1, { signal } = {}) {
  return data(client.get(`/admin/accounts/${publicId}/activity/`, {
    params: { page },
    signal,
  }))
}

export function getAccountStatusImpact(publicId, payload) {
  return data(client.post(`/admin/accounts/${publicId}/status-impact/`, payload))
}

export function changeAccountStatus(publicId, payload, impactToken) {
  return data(client.post(`/admin/accounts/${publicId}/change-status/`, {
    ...payload,
    impact_token: impactToken,
  }))
}

export function getAccountSessionsImpact(publicId, reason) {
  return data(client.post(`/admin/accounts/${publicId}/revoke-sessions-impact/`, {
    reason,
  }))
}

export function revokeAccountSessions(publicId, reason, impactToken) {
  return data(client.post(`/admin/accounts/${publicId}/revoke-sessions/`, {
    reason,
    impact_token: impactToken,
  }))
}

export function sendAdminAccountPasswordReset(publicId, payload) {
  return data(client.post(`/admin/accounts/${publicId}/send-password-reset/`, payload))
}

export function resendAdminAccountVerification(publicId) {
  return data(client.post(`/admin/accounts/${publicId}/resend-verification/`))
}

export function getAdminInvitations(params = {}, { signal } = {}) {
  return data(client.get('/admin/account-invitations/', { params, signal }))
}

export function getAvailableAdminInvitationRoles({ signal } = {}) {
  return data(client.get('/admin/account-invitations/available-roles/', { signal }))
}

export function createAdminInvitation(payload) {
  return data(client.post('/admin/account-invitations/', payload))
}

export function updateAdminInvitation(publicId, payload) {
  return data(client.patch(`/admin/account-invitations/${publicId}/`, payload))
}

export function resendAdminInvitation(publicId) {
  return data(client.post(`/admin/account-invitations/${publicId}/resend/`))
}

export function revokeAdminInvitation(publicId, reason) {
  return data(client.post(`/admin/account-invitations/${publicId}/revoke/`, { reason }))
}

export function validateAdminInvitation(token, { signal } = {}) {
  return data(client.get('/auth/admin-invitations/validate/', {
    params: { token },
    signal,
  }))
}

export function acceptAdminInvitation(payload) {
  return data(client.post('/auth/admin-invitations/accept/', payload))
}

export function getProvisioningScopes({ signal } = {}) {
  return data(client.get('/admin/provisioning-scopes/', { signal }))
}

export function createProvisioningScope(payload) {
  return data(client.post('/admin/provisioning-scopes/', payload))
}

export function getProvisioningScopeImpact(publicId, isActive) {
  return data(client.post(`/admin/provisioning-scopes/${publicId}/status-impact/`, {
    is_active: isActive,
  }))
}

export function setProvisioningScopeStatus(publicId, isActive, impactToken) {
  const action = isActive ? 'activate' : 'deactivate'
  return data(client.post(`/admin/provisioning-scopes/${publicId}/${action}/`, {
    impact_token: impactToken,
  }))
}
