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

export async function getCampaignHealth(publicId) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/health/`)
  return data
}

export async function downloadCampaignReport(publicId, type) {
  const { data } = await api.get(`/employer/campaigns/${publicId}/report/export/`, {
    params: { type },
    responseType: 'blob',
  })
  return data
}

export async function getPublicCampaign(slug) {
  const { data } = await api.get(`/public/campaigns/${slug}/`)
  return data
}

export async function getSocialConnections() {
  const { data } = await api.get('/employer/social/connections/')
  return data
}

export async function getSocialNetworks() {
  const { data } = await api.get('/employer/social/networks/')
  return data
}

export async function startSocialConnect(network) {
  const { data } = await api.post(`/employer/social/${network}/authorize/`)
  return data.url
}

export async function getPendingSocialAccounts(network, nonce) {
  const { data } = await api.get(`/employer/social/${network}/pending/${nonce}/`)
  return data
}

export async function selectSocialAccount(network, nonce, accountId) {
  const { data } = await api.post(`/employer/social/${network}/pending/${nonce}/`, { account_id: accountId })
  return data
}

export async function disconnectSocialConnection(connectionId) {
  await api.delete(`/employer/social/connections/${connectionId}/`)
}

const postsPath = (publicId, channelId) => `${channelsPath(publicId)}${channelId}/posts/`

export async function getChannelPosts(publicId, channelId) {
  const { data } = await api.get(postsPath(publicId, channelId))
  return data
}

export async function scheduleChannelPost(publicId, channelId, payload) {
  const { data } = await api.post(postsPath(publicId, channelId), payload)
  return data
}

const postImagesPath = (publicId, channelId) => `${channelsPath(publicId)}${channelId}/post-images/`

export async function getChannelPostImageChoices(publicId, channelId) {
  const { data } = await api.get(postImagesPath(publicId, channelId))
  return data
}

export async function uploadChannelPostImage(publicId, channelId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(postImagesPath(publicId, channelId), formData)
  return data
}

export async function rescheduleChannelPost(publicId, channelId, postId, scheduledFor) {
  const { data } = await api.patch(`${postsPath(publicId, channelId)}${postId}/`, { scheduled_for: scheduledFor })
  return data
}

export async function cancelChannelPost(publicId, channelId, postId) {
  await api.delete(`${postsPath(publicId, channelId)}${postId}/`)
}
