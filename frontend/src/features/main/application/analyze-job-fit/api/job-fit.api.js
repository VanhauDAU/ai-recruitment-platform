import api from '@/shared/api/client'

const ANALYSES_PATH = '/candidate/matching/analyses/'

// Yêu cầu phân tích một CV với một tin. Đã có kết quả thì trả ngay (cached),
// chưa có thì trả bản ghi đang chờ để poll.
export async function requestJobFit({ jobSlug, cvPublicId }) {
  const { data } = await api.post(ANALYSES_PATH, { job: jobSlug, cv: cvPublicId })
  return data
}

export async function getJobFit(publicId) {
  const { data } = await api.get(`${ANALYSES_PATH}${publicId}/`)
  return data
}

// Các lần phân tích gần nhất của chính người dùng cho một tin, mới nhất trước.
export async function listJobFits(jobSlug) {
  const { data } = await api.get(ANALYSES_PATH, { params: { job: jobSlug } })
  return Array.isArray(data) ? data : []
}
