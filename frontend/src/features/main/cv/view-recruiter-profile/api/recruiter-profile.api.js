import api from '@/shared/api/client'

/** Hồ sơ trích xuất từ CV của chính ứng viên: `{status, error_code, profile}`. */
export async function getCvExtractedProfile(cvPublicId) {
  const { data } = await api.get(`/candidate/matching/cv-profiles/${cvPublicId}/`)
  return data
}
