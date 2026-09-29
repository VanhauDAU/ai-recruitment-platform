import api from '@/shared/api/client'

const generationPath = (publicId = '') => `/jobs/mine/ai-generations/${publicId ? `${publicId}/` : ''}`

export async function createJobAiGeneration(payload) {
  const { data } = await api.post(generationPath(), payload)
  return data
}

export async function getJobAiGeneration(publicId) {
  const { data } = await api.get(generationPath(publicId))
  return data
}

export async function cancelJobAiGeneration(publicId) {
  const { data } = await api.post(`${generationPath(publicId)}cancel/`)
  return data
}

export async function sendJobAiGenerationFeedback(publicId, payload) {
  const { data } = await api.post(`${generationPath(publicId)}feedback/`, payload)
  return data
}
