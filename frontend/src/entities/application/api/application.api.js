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

export async function getCandidateApplications() {
  const { data } = await api.get('/v2/applications/')
  return data.results || data
}

export async function getRecruiterApplications(params = {}) {
  const { data } = await api.get('/v2/recruiter/applications/', { params })
  return data.results || data
}

export async function updateApplicationStatus(publicId, payload) {
  const { data } = await api.patch(`/v2/recruiter/applications/${publicId}/`, payload)
  return data
}

export async function getRecruiterApplicationSnapshot(publicId) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/cv/`)
  return data
}

export async function getApplicationHistory(publicId) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/history/`)
  return data.results || data
}
