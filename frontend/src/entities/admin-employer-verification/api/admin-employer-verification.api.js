import client from '@/shared/api/client'

async function data(request) {
  const response = await request
  return response.data
}

export function getAdminEmployerVerifications(params = {}, { signal } = {}) {
  return data(client.get('/admin/employer-verifications/', { params, signal }))
}

export function getAdminEmployerVerificationSummary({ signal } = {}) {
  return data(client.get('/admin/employer-verifications/summary/', { signal }))
}

export function getAdminEmployerVerification(publicId, { signal } = {}) {
  return data(client.get(`/admin/employer-verifications/${publicId}/`, { signal }))
}

export function startAdminEmployerVerificationReview(publicId) {
  return data(client.post(`/admin/employer-verifications/${publicId}/start-review/`))
}

export function reviewAdminEmployerDocument(casePublicId, documentPublicId, payload) {
  return data(client.post(
    `/admin/employer-verifications/${casePublicId}/documents/${documentPublicId}/review/`,
    payload,
  ))
}

export function getAdminEmployerDecisionImpact(publicId, payload) {
  return data(client.post(
    `/admin/employer-verifications/${publicId}/decision-impact/`,
    payload,
  ))
}

export function decideAdminEmployerVerification(publicId, payload) {
  return data(client.post(`/admin/employer-verifications/${publicId}/decision/`, payload))
}

export function unlockAdminEmployerVerificationResubmission(publicId, payload) {
  return data(client.post(
    `/admin/employer-verifications/${publicId}/unlock-resubmission/`,
    payload,
  ))
}

const VERIFICATION_LIFECYCLE_PATHS = {
  revoked: 'revoke',
  expired: 'expire',
}

function verificationLifecyclePath(action) {
  const path = VERIFICATION_LIFECYCLE_PATHS[action]
  if (!path) throw new Error('Unsupported employer verification lifecycle action.')
  return path
}

export function getAdminEmployerLifecycleImpact(publicId, action, payload) {
  const path = verificationLifecyclePath(action)
  return data(client.post(
    `/admin/employer-verifications/${publicId}/${path}-impact/`,
    payload,
  ))
}

export function changeAdminEmployerVerificationLifecycle(publicId, action, payload) {
  const path = verificationLifecyclePath(action)
  return data(client.post(
    `/admin/employer-verifications/${publicId}/${path}/`,
    payload,
  ))
}

export function refreshAdminEmployerTaxLookup(publicId) {
  return data(client.post(`/admin/employer-verifications/${publicId}/refresh-tax-lookup/`))
}

async function getAdminEmployerDocumentBlob(
  casePublicId,
  documentPublicId,
  { signal, intent },
) {
  const response = await client.get(
    `/admin/employer-verifications/${casePublicId}/documents/${documentPublicId}/content/`,
    { responseType: 'blob', signal, params: { intent } },
  )
  const contentType = response.headers['content-type'] || response.data.type
  const blob = contentType && response.data.type !== contentType
    ? response.data.slice(0, response.data.size, contentType)
    : response.data
  return {
    blob,
    contentType,
  }
}

export function getAdminEmployerDocumentContent(
  casePublicId,
  documentPublicId,
  { signal } = {},
) {
  return getAdminEmployerDocumentBlob(
    casePublicId,
    documentPublicId,
    { signal, intent: 'preview' },
  )
}

export function downloadAdminEmployerDocument(casePublicId, documentPublicId) {
  return getAdminEmployerDocumentBlob(
    casePublicId,
    documentPublicId,
    { intent: 'download' },
  )
}

export function getAdminCompanyUpdateRequests(params = {}, { signal } = {}) {
  return data(client.get('/admin/company-update-requests/', { params, signal }))
}

export function getAdminCompanyUpdateRequest(publicId, { signal } = {}) {
  return data(client.get(`/admin/company-update-requests/${publicId}/`, { signal }))
}

export function reviewAdminCompanyUpdateDocument(requestPublicId, documentPublicId, payload) {
  return data(client.post(
    `/admin/company-update-requests/${requestPublicId}/documents/${documentPublicId}/review/`,
    payload,
  ))
}

export function reviewAdminCompanyUpdateRequest(requestPublicId, payload) {
  return data(client.post(
    `/admin/company-update-requests/${requestPublicId}/review/`,
    payload,
  ))
}

export function refreshAdminCompanyUpdateTaxLookup(requestPublicId) {
  return data(client.post(
    `/admin/company-update-requests/${requestPublicId}/refresh-tax-lookup/`,
  ))
}

export async function getAdminCompanyUpdateDocumentContent(
  requestPublicId,
  documentPublicId,
  { signal } = {},
) {
  const response = await client.get(
    `/admin/company-update-requests/${requestPublicId}/documents/${documentPublicId}/content/`,
    { responseType: 'blob', signal },
  )
  return response.data
}
