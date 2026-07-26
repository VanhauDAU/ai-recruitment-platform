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
