import api from '@/shared/api/client'

export async function getCampaigns(params = {}) {
  const { data } = await api.get('/employer/campaigns/', { params })
  return Array.isArray(data)
    ? { count: data.length, next: null, previous: null, results: data }
    : data
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

export async function changeCampaignStatus(publicId, status, confirmationCode = '') {
  const { data } = await api.post(`/employer/campaigns/${publicId}/status/`, {
    status,
    ...(confirmationCode ? { confirmation_code: confirmationCode } : {}),
  })
  return data
}

export async function getCampaignPauseImpact(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/pause-impact/`)
  return data
}

export async function getCampaignActivities(publicId, params = {}) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/activities/`, { params })
  return Array.isArray(data)
    ? { count: data.length, next: null, previous: null, results: data }
    : data
}

export async function getCampaignOptions() {
  const { data } = await api.get('/employer/campaigns/options/')
  return data.results || data
}

export async function getCampaignReport(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/report/`)
  return data
}

export async function getCampaignJobPerformance(publicId, days = 7, jobPublicId = '') {
  const { data } = await api.get(`/employer/campaigns/${publicId}/job-performance/`, {
    params: {
      days,
      ...(jobPublicId ? { job: jobPublicId } : {}),
    },
  })
  return data
}

export async function getCampaignLaunch(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/launch/`)
  return data
}

export async function saveCampaignLaunchSelection(publicId, { publishJobIds = [], attachJobIds = [] }) {
  const { data } = await api.put(`/employer/campaigns/${publicId}/launch/`, {
    publish_job_ids: publishJobIds,
    attach_job_ids: attachJobIds,
  })
  return data
}

export async function launchCampaign(publicId, { mode, acceptedStatementVersion }) {
  const { data } = await api.post(`/employer/campaigns/${publicId}/launch/`, {
    mode,
    accepted_statement_version: acceptedStatementVersion,
  })
  return data
}

const channelsPath = (publicId) => `/employer/campaigns/${publicId}/channels/`

export async function getCampaignChannels(publicId) {
  const { data } = await api.get(channelsPath(publicId))
  return data
}

export async function createCampaignChannel(publicId, payload) {
  const { data } = await api.post(channelsPath(publicId), payload)
  return data
}

export async function updateCampaignChannel(publicId, channelId, payload) {
  const { data } = await api.patch(`${channelsPath(publicId)}${channelId}/`, payload)
  return data
}

export async function deleteCampaignChannel(publicId, channelId) {
  await api.delete(`${channelsPath(publicId)}${channelId}/`)
}

export async function generateCampaignChannelContent(publicId, channelId) {
  const { data } = await api.post(`${channelsPath(publicId)}${channelId}/content/`)
  return data
}

export async function getCampaignChannelCosts(publicId, channelId) {
  const { data } = await api.get(`${channelsPath(publicId)}${channelId}/costs/`)
  return data
}

export async function addCampaignChannelCost(publicId, channelId, payload) {
  const { data } = await api.post(`${channelsPath(publicId)}${channelId}/costs/`, payload)
  return data
}

export async function deleteCampaignChannelCost(publicId, channelId, costId) {
  await api.delete(`${channelsPath(publicId)}${channelId}/costs/${costId}/`)
}

export async function getCampaignChannelReport(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/channel-report/`)
  return data
}

export async function getPublicCampaign(slug) {
  const { data } = await api.get(`/campaigns/public/${slug}/`)
  return data
}
