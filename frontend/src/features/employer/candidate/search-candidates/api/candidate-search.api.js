import api from '@/shared/api/client'

export const candidateSearchKeys = {
  all: () => ['candidate-search'],
  list: (params) => ['candidate-search', 'list', params],
  detail: (ref, jobPublicId) => ['candidate-search', 'detail', ref, jobPublicId],
}

/** Ứng viên ẩn danh phù hợp với một tin: `{count, page_size, results}`. */
export async function searchCandidates(params) {
  const { data } = await api.get('/employer/candidate-search/', { params })
  return data
}

/** Hồ sơ trích xuất ẩn danh và mức phù hợp chi tiết của một ứng viên (có ghi nhật ký). */
export async function getCandidateSearchDetail(ref, jobPublicId) {
  const { data } = await api.get(`/employer/candidate-search/${ref}/`, { params: { job: jobPublicId } })
  return data
}

export async function inviteSearchCandidate(ref, jobPublicId) {
  await api.post(`/employer/candidate-search/${ref}/invite/`, { job: jobPublicId })
}
