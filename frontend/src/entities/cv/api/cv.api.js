import api from '@/shared/api/client'

export async function getMyCvs() {
  const { data } = await api.get('/v2/cvs/')
  return Array.isArray(data) ? data : data.results || []
}

export async function getCv(publicId) {
  const { data } = await api.get(`/v2/cvs/${publicId}/`)
  return data
}

export async function getCvDraft(publicId) {
  const { data, headers } = await api.get(`/v2/cvs/${publicId}/draft/`)
  return { ...data, etag: headers.etag }
}

export async function updateCvDraft(publicId, document, lockVersion, clientSessionId) {
  const payload = clientSessionId ? { ...document, client_session_id: clientSessionId } : document
  const { data, headers } = await api.put(
    `/v2/cvs/${publicId}/draft/`,
    payload,
    { headers: { 'If-Match': `"lock-version-${lockVersion}"` } },
  )
  return { ...data, etag: headers.etag }
}

export async function saveCvVersion(publicId, lockVersion) {
  const { data } = await api.post(
    `/v2/cvs/${publicId}/save-version/`,
    undefined,
    { headers: { 'If-Match': `"lock-version-${lockVersion}"` } },
  )
  return data
}

export async function publishCvVersion(publicId, lockVersion) {
  const { data } = await api.post(
    `/v2/cvs/${publicId}/publish/`,
    undefined,
    { headers: { 'If-Match': `"lock-version-${lockVersion}"` } },
  )
  return data
}

export async function switchCvTemplate(publicId, templatePublicId, lockVersion, clientSessionId) {
  const { data, headers } = await api.put(
    `/v2/cvs/${publicId}/template/`,
    { template_public_id: templatePublicId, ...(clientSessionId ? { client_session_id: clientSessionId } : {}) },
    { headers: { 'If-Match': `"lock-version-${lockVersion}"` } },
  )
  return { ...data, draft: { ...data.draft, etag: headers.etag } }
}

export async function getCvOwnerView(publicId) {
  const { data } = await api.get(`/v2/cvs/${publicId}/view/`)
  return data
}

export async function getSharedCv(token) {
  const { data } = await api.get(`/v2/cvs/shares/${encodeURIComponent(token)}/`)
  return data
}

export async function getCvSharedLinks(publicId) {
  const { data } = await api.get(`/v2/cvs/${publicId}/shared-links/`)
  return data
}

export async function createCvSharedLink(publicId, options = {}) {
  const { data } = await api.post(`/v2/cvs/${publicId}/shared-links/`, options)
  return data
}

export async function revokeCvSharedLink(publicId, linkPublicId) {
  await api.delete(`/v2/cvs/${publicId}/shared-links/${linkPublicId}/`)
}

export async function getCvVersions(publicId) {
  const { data } = await api.get(`/v2/cvs/${publicId}/versions/`)
  return Array.isArray(data) ? data : (data.results || [])
}

export async function createCvPdfExport(publicId, versionPublicId) {
  const { data } = await api.post(
    `/v2/cvs/${publicId}/exports/`,
    versionPublicId ? { version_public_id: versionPublicId } : {},
  )
  return data
}

export async function getCvPdfExport(publicId, exportPublicId) {
  const { data } = await api.get(`/v2/cvs/${publicId}/exports/${exportPublicId}/`)
  return data
}

export async function retryCvPdfExport(publicId, exportPublicId) {
  const { data } = await api.post(`/v2/cvs/${publicId}/exports/${exportPublicId}/retry/`, {})
  return data
}

export async function downloadCvPdf(downloadUrl) {
  const { data } = await api.get(downloadUrl, { responseType: 'blob' })
  return data
}
