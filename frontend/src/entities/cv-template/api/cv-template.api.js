import api from '@/shared/api/client'

function results(data) {
  return Array.isArray(data) ? data : data.results || []
}

export async function getCvTemplates(params = {}) {
  const { data } = await api.get('/v2/cv-templates/', { params })
  return { ...data, results: results(data) }
}

export async function getCvTemplate(slug, locale = 'vi-VN') {
  const { data } = await api.get(`/v2/cv-templates/${slug}/`, { params: { locale } })
  return data
}

export async function getRelatedCvTemplates(slug, locale = 'vi-VN') {
  const { data } = await api.get(`/v2/cv-templates/${slug}/related/`, { params: { locale } })
  return results(data)
}

export async function getCvCategories(categoryType) {
  const { data } = await api.get('/v2/cv-categories/', {
    params: categoryType ? { type: categoryType } : undefined,
  })
  return results(data)
}

export async function getCvSampleContents(locale = 'vi-VN') {
  const { data } = await api.get('/v2/cv-sample-contents/', { params: { locale } })
  return results(data)
}

export async function getCvSampleContent(publicId) {
  const { data } = await api.get(`/v2/cv-sample-contents/${publicId}/`)
  return data
}

export async function getCvPositionOptions(query = '') {
  const { data } = await api.get('/v2/cv-position-options/', {
    params: query ? { q: query } : undefined,
  })
  return results(data)
}

export async function getCvPositionPreview(positionPublicId, locale = 'vi-VN') {
  const { data } = await api.get('/v2/cv-position-preview/', {
    params: { position_public_id: positionPublicId, locale },
  })
  return data
}
