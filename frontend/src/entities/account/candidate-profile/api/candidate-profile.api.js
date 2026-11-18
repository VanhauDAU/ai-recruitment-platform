import api from '@/shared/api/client'

export async function getCandidateProfile() {
  const { data } = await api.get('/candidate/profile/')
  return data
}

export async function updateCandidateProfile(profile) {
  const { data } = await api.patch('/candidate/profile/', profile)
  return data
}
