import api from '@/shared/api/client'

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
