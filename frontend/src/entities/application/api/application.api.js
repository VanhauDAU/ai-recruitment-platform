import api from '@/shared/api/client'

export async function submitJobApplication({
  jobPublicId,
  cvPublicId,
  versionPublicId,
  coverLetter = '',
  preferredLocationIds = [],
  allowAiAnalysis = false,
  dataProcessingConsent,
  contactName = '',
  contactEmail = '',
  contactPhone = '',
}) {
  const { data } = await api.post('/v2/applications/', {
    job_public_id: jobPublicId,
    cv_public_id: cvPublicId,
    version_public_id: versionPublicId,
    cover_letter: coverLetter,
    preferred_location_ids: preferredLocationIds,
    allow_ai_analysis: allowAiAnalysis,
    data_processing_consent: dataProcessingConsent,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
  })
  return data
}
