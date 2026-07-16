import api from '@/shared/api/client'

export async function getMyCvs() {
  const { data } = await api.get('/v2/cvs/')
  return Array.isArray(data) ? data : data.results || []
}

export async function deleteCv(publicId) {
  await api.delete(`/v2/cvs/${publicId}/`)
}

export async function renameCv(publicId, title) {
  const { data } = await api.patch(`/v2/cvs/${publicId}/`, { title })
  return data
}

export async function setDefaultCv(publicId, isDefault) {
  const { data } = await api.patch(`/v2/cvs/${publicId}/`, { is_default: isDefault })
  return data
}

export async function importCvFile(file, title, options = {}) {
  const body = new FormData()
  body.append('file', file)
  if (title) body.append('title', title)
  if (options.templatePublicId) body.append('template_public_id', options.templatePublicId)
  if (options.language) body.append('language', options.language)
  if (options.themeColor) body.append('theme_color', options.themeColor)
  const { data } = await api.post('/v2/cvs/imports/', body, {
    headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {},
  })
  return data
}

export async function retryCvImport(publicId) {
  const { data } = await api.post(`/v2/cvs/${publicId}/imports/retry/`, {})
  return data
}

export async function waitForCvImport(publicId, { timeoutMs = 60_000, intervalMs = 1_000 } = {}) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const cv = await getCv(publicId)
    if (cv.processing_status === 'analyzed') return cv
    if (cv.processing_status === 'failed') {
      const error = new Error(cv.import_job?.failure_code || 'import_failed')
      error.code = cv.import_job?.failure_code || 'import_failed'
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  const error = new Error('import_timeout')
  error.code = 'import_timeout'
  throw error
}

export async function duplicateCv(publicId, title) {
  const { data } = await api.post(
    `/v2/cvs/${publicId}/duplicate/`,
    title ? { title } : {},
  )
  return data
}

export async function getCv(publicId) {
  const { data } = await api.get(`/v2/cvs/${publicId}/`)
  return data
}

export async function getCvDraft(publicId) {
  const { data, headers } = await api.get(`/v2/cvs/${publicId}/draft/`)
  return { ...data, etag: headers.etag }
}

export async function getLatestRecoverableDraft() {
  const response = await api.get('/v2/cvs/latest-recoverable-draft/')
  return response.status === 204 ? null : response.data
}

export async function getCvTemplatePreview(publicId, templatePublicId, signal) {
  const config = { params: { template_public_id: templatePublicId } }
  if (signal) config.signal = signal
  const { data } = await api.get(`/v2/cvs/${publicId}/template-preview/`, config)
  return data
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

export async function switchCvTemplate(publicId, templatePublicId, lockVersion, clientSessionId, themeColor) {
  const { data, headers } = await api.put(
    `/v2/cvs/${publicId}/template/`,
    {
      template_public_id: templatePublicId,
      ...(clientSessionId ? { client_session_id: clientSessionId } : {}),
      ...(themeColor ? { theme_color: themeColor } : {}),
    },
    { headers: { 'If-Match': `"lock-version-${lockVersion}"` } },
  )
  return { ...data, draft: { ...data.draft, etag: headers.etag } }
}

export async function applyCvSample(publicId, sampleContentPublicId, lockVersion, clientSessionId) {
  const { data, headers } = await api.post(
    `/v2/cvs/${publicId}/apply-sample/`,
    {
      sample_content_public_id: sampleContentPublicId,
      ...(clientSessionId ? { client_session_id: clientSessionId } : {}),
    },
    { headers: { 'If-Match': `"lock-version-${lockVersion}"` } },
  )
  return { ...data, etag: headers.etag }
}

export async function uploadCvAsset(file) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post('/v2/cvs/assets/', body)
  return data
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
