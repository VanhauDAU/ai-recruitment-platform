import api from '@/shared/api/client'

export async function getCompanyFollow(publicId, { signal } = {}) {
  const { data } = await api.get(`/public/companies/${publicId}/follow/`, { signal })
  return data
}

/** PUT idempotent: `{}` để theo dõi, `{ notify_new_jobs }` để đổi lựa chọn nhận email. */
export async function followCompany(publicId, payload = {}) {
  const { data } = await api.put(`/public/companies/${publicId}/follow/`, payload)
  return data
}

export async function unfollowCompany(publicId) {
  const { data } = await api.delete(`/public/companies/${publicId}/follow/`)
  return data
}

export async function getFollowedCompanies(params = {}, { signal } = {}) {
  const { data } = await api.get('/candidate/followed-companies/', { params, signal })
  return data
}
