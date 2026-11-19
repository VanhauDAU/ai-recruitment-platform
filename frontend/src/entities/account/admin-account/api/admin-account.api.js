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

/** Merged activity timeline, newest first; `before` is the previous page's `next_cursor`. */
export function getAdminAccountActivity(publicId, { before, category, limit } = {}, { signal } = {}) {
  const params = Object.fromEntries(
    Object.entries({ before, category, limit }).filter(([, value]) => value),
  )
  return data(client.get(`/admin/accounts/${publicId}/activity/`, { params, signal }))
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

export function getAccountResourceHoldImpact(publicId, payload) {
  return data(client.post(`/admin/accounts/${publicId}/resource-hold-impact/`, payload))
}

export function releaseAccountResourceHolds(publicId, payload, impactToken) {
  return data(client.post(`/admin/accounts/${publicId}/release-resource-holds/`, {
    ...payload,
    impact_token: impactToken,
  }))
}

export function getAccountEmailImpact(publicId, payload) {
  return data(client.post(`/admin/accounts/${publicId}/email-impact/`, payload))
}

export function changeAccountEmail(publicId, payload, impactToken) {
  return data(client.post(`/admin/accounts/${publicId}/change-email/`, {
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

export function getEmployerCompanyUnlinkImpact(publicId, reason) {
  return data(client.post(`/admin/accounts/${publicId}/company-unlink-impact/`, { reason }))
}

export function unlinkEmployerCompany(publicId, reason, impactToken) {
  return data(client.post(`/admin/accounts/${publicId}/unlink-company/`, {
    reason,
    impact_token: impactToken,
  }))
}

export function getAdminInvitations(params = {}, { signal } = {}) {
  return data(client.get('/admin/account-invitations/', { params, signal }))
}

export function createAdminInvitation(payload) {
  return data(client.post('/admin/account-invitations/', payload))
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
