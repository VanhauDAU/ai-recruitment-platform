import api from '@/shared/api/client'

export async function getCampaigns(params = {}) {
  const { data } = await api.get('/employer/campaigns/', { params })
  return data.results || data
}

export async function getCampaign(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/`)
  return data
}

export async function createCampaign(payload) {
  const { data } = await api.post('/employer/campaigns/', payload)
  return data
}

export async function updateCampaign(publicId, payload) {
  const { data } = await api.patch(`/employer/campaigns/${publicId}/`, payload)
  return data
}

export async function changeCampaignStatus(publicId, status) {
  const { data } = await api.post(`/employer/campaigns/${publicId}/status/`, { status })
  return data
}

export async function getCampaignOptions() {
  const { data } = await api.get('/employer/campaigns/options/')
  return data.results || data
}

export async function getCampaignSuggestions() {
  const { data } = await api.get('/employer/campaigns/suggestions/')
  return data.results || data
}

export async function createCampaignFromNeed(publicId) {
  const { data } = await api.post(`/employer/campaigns/from-need/${publicId}/`)
  return data
}

export async function getCampaignReport(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/report/`)
  return data
}
