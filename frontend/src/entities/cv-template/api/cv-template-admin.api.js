import api from '@/shared/api/client'

async function list(path) {
  const { data } = await api.get(path)
  return data.results || data
}

export const getAdminCvTemplates = () => list('/v2/admin/cv-templates/')
export const getAdminCvSamples = () => list('/v2/admin/cv-sample-contents/')
export const getAdminCvBlueprints = () => list('/v2/admin/cv-content-blueprints/')
export const getAdminCvCategories = () => list('/v2/admin/cv-categories/')
export const getAdminCvColors = () => list('/v2/admin/cv-colors/')
export const getAdminCvBackgrounds = () => list('/v2/admin/cv-backgrounds/')

export async function createAdminCvBackground(file, title = '') {
  const body = new FormData()
  body.append('file', file)
  body.append('title', title)
  const { data } = await api.post('/v2/admin/cv-backgrounds/', body)
  return data
}

export async function updateAdminCvBackground(publicId, payload) {
  const { data } = await api.patch(`/v2/admin/cv-backgrounds/${publicId}/`, payload)
  return data
}

export async function archiveAdminCvBackground(publicId) {
  await api.delete(`/v2/admin/cv-backgrounds/${publicId}/`)
}

export async function createAdminTemplateVersion(templateId) {
  const { data } = await api.post(`/v2/admin/cv-templates/${templateId}/versions/`, {})
  return data
}

export async function publishAdminTemplateVersion(templateId, versionId) {
  const { data } = await api.post(`/v2/admin/cv-templates/${templateId}/versions/${versionId}/publish/`, {})
  return data
}

export async function regenerateAdminTemplateSnapshots(templateId) {
  const { data } = await api.post(`/v2/admin/cv-templates/${templateId}/snapshots/regenerate/`, {})
  return data
}

export async function updateAdminCvSample(sampleId, payload) {
  const { data } = await api.patch(`/v2/admin/cv-sample-contents/${sampleId}/`, payload)
  return data
}

export async function publishAdminCvSample(sampleId) {
  const { data } = await api.post(`/v2/admin/cv-sample-contents/${sampleId}/publish/`, {})
  return data
}

export async function archiveAdminCvSample(sampleId) {
  const { data } = await api.post(`/v2/admin/cv-sample-contents/${sampleId}/archive/`, {})
  return data
}

export async function activateAdminCvBlueprint(blueprintId) {
  const { data } = await api.post(`/v2/admin/cv-content-blueprints/${blueprintId}/activate/`, {})
  return data
}
