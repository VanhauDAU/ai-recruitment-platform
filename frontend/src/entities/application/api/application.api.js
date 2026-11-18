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
  campaignRef = '',
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
    ...(campaignRef ? { campaign_ref: campaignRef } : {}),
  })
  return data
}

/** Take back an application that has no outcome yet. */
export async function withdrawCandidateApplication(publicId) {
  const { data } = await api.post(`/v2/applications/${publicId}/withdraw/`)
  return data
}

/** Ask ProCV to remind the recruiter about an application still unanswered. */
export async function remindRecruiterOfApplication(publicId) {
  const { data } = await api.post(`/v2/applications/${publicId}/remind/`)
  return data
}

/** Earlier, replaced submissions of the same candidate to the same job. */
export async function getRecruiterApplicationSubmissions(publicId) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/submissions/`)
  return data
}

/** Limits for submissions, reminders and automatic rejection, as the server enforces them. */
export async function getApplicationRules() {
  const { data } = await api.get('/v2/applications/rules/')
  return data
}

export async function getCandidateApplications() {
  const { data } = await api.get('/v2/applications/')
  return data.results || data
}

export async function getRecruiterApplicationPage(params = {}) {
  const { data } = await api.get('/v2/recruiter/applications/', { params })
  return Array.isArray(data)
    ? { count: data.length, next: null, previous: null, results: data }
    : data
}

export async function exportRecruiterApplications(params = {}) {
  const { data, headers } = await api.get('/v2/recruiter/applications/export/', {
    params,
    responseType: 'blob',
  })
  return {
    blob: data,
    filename: headers['content-disposition']?.match(/filename="?([^"]+)"?/)?.[1]
      || `danh-sach-cv-${new Date().toISOString().slice(0, 10)}.csv`,
  }
}

/** Private note/rating only; status changes go through `decideApplicationStatus`. */
export async function updateApplicationAssessment(publicId, payload) {
  const { data } = await api.patch(`/v2/recruiter/applications/${publicId}/`, payload)
  return data
}

/** Returns `{ application, candidate_notice_at }`; the candidate is told at that time. */
export async function decideApplicationStatus(publicId, status) {
  const { data } = await api.post(`/v2/recruiter/applications/${publicId}/status/`, { status })
  return data
}

export async function undoApplicationStatusChange(publicId) {
  const { data } = await api.post(`/v2/recruiter/applications/${publicId}/status/undo/`)
  return data
}

export async function requestApplicationCvExport(publicId) {
  const { data } = await api.post(`/v2/recruiter/applications/${publicId}/cv/exports/`)
  return data
}

export async function getApplicationCvExport(publicId, exportId) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/cv/exports/${exportId}/`)
  return data
}

/** `downloadUrl` is the absolute URL returned by the export endpoints. */
export async function downloadApplicationCv(downloadUrl) {
  const { data } = await api.get(downloadUrl, { responseType: 'blob' })
  return data
}

/** The file a candidate uploaded as their CV, as PDF. `download` also tells the candidate. */
export async function getApplicationCvFile(publicId, { download = false } = {}) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/cv/file/`, {
    params: download ? { download: 1 } : undefined,
    responseType: 'blob',
  })
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

export async function getApplicationReviewLinks(publicId) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/review-links/`)
  return data
}

/** Returns `{ link, url }`; `url` carries the only copy of the raw token. */
export async function createApplicationReviewLink(publicId, payload) {
  const { data } = await api.post(`/v2/recruiter/applications/${publicId}/review-links/`, payload)
  return data
}

export async function revokeApplicationReviewLink(publicId, linkId) {
  const { data } = await api.post(`/v2/recruiter/applications/${publicId}/review-links/${linkId}/revoke/`)
  return data
}

export async function getApplicationReviews(publicId) {
  const { data } = await api.get(`/v2/recruiter/applications/${publicId}/reviews/`)
  return data
}

/** Public reviewer endpoints: the token in the URL is the only credential. */
export async function getPublicApplicationReview(token) {
  const { data } = await api.get(`/v2/application-reviews/${encodeURIComponent(token)}/`)
  return data
}

export async function submitPublicApplicationReview(token, payload) {
  const { data } = await api.put(`/v2/application-reviews/${encodeURIComponent(token)}/`, payload)
  return data
}

export async function getCandidateBlocks(page = 1) {
  const { data } = await api.get('/v2/recruiter/candidate-blocks/', { params: { page } })
  return data
}

export async function blockCandidate(payload) {
  const { data } = await api.post('/v2/recruiter/candidate-blocks/', payload)
  return data
}

export async function liftCandidateBlock(publicId) {
  const { data } = await api.post(`/v2/recruiter/candidate-blocks/${publicId}/lift/`)
  return data
}

export async function getTalentPool(params = {}) {
  const { data } = await api.get('/v2/recruiter/talent-pool/', { params })
  return data
}

export async function addToTalentPool(payload) {
  const { data } = await api.post('/v2/recruiter/talent-pool/', payload)
  return data
}

export async function removeFromTalentPool(publicId) {
  await api.delete(`/v2/recruiter/talent-pool/${publicId}/`)
}

export async function getTalentSuggestions(jobPublicId) {
  const { data } = await api.get('/v2/recruiter/talent-pool/suggestions/', { params: { job: jobPublicId } })
  return data
}

export async function inviteFromTalentPool(publicId, jobPublicId) {
  await api.post(`/v2/recruiter/talent-pool/${publicId}/invite/`, { job_public_id: jobPublicId })
}

export async function getMyTalentPools() {
  const { data } = await api.get('/v2/talent-pools/mine/')
  return data.results || data
}

export async function withdrawFromTalentPool(publicId) {
  await api.post(`/v2/talent-pools/mine/${publicId}/withdraw/`)
}
