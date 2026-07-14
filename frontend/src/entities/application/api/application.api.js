import api from '@/shared/api/client'

export async function submitJobApplication({ jobPublicId, cvPublicId, versionPublicId, coverLetter = '' }) {
  const { data } = await api.post('/v2/applications/', {
    job_public_id: jobPublicId,
    cv_public_id: cvPublicId,
    version_public_id: versionPublicId,
    cover_letter: coverLetter,
  })
  return data
}
