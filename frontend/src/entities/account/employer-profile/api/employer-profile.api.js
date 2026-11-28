import api from '@/shared/api/client'
import { prepareCleanUpload } from '@/shared/api/upload-session'
import { shrinkImage } from '@/shared/lib/shrink-image'

const LEGACY_UPLOAD_FALLBACK = Object.freeze({ legacy_file: true })

function apiErrorCode(error) {
  return error?.response?.data?.code || error?.response?.data?.detail?.code || error?.code
}

export async function prepareEmployerUpload(file, purpose, options = {}) {
  try {
    return await prepareCleanUpload(file, purpose, options)
  } catch (error) {
    if (apiErrorCode(error) === 'UPLOAD_PIPELINE_DISABLED') {
      return LEGACY_UPLOAD_FALLBACK
    }
    throw error
  }
}

export async function getEmployerProfile() {
  const { data } = await api.get('/employer/me/')
  return data
}

export async function completeEmployerRegistration(payload) {
  const { data } = await api.post('/employer/onboarding/registration/', payload)
  return data
}

export async function sendEmployerPhoneOtp(phone, password) {
  const { data } = await api.post('/employer/phone/send-otp/', { phone, password })
  return data
}

export async function getEmployerPhoneChallenge(publicId) {
  const { data } = await api.get('/employer/phone/challenges/' + publicId + '/')
  return data
}

export async function verifyEmployerPhoneOtp(challengeId, code) {
  const { data } = await api.post('/employer/phone/verify/', {
    challenge_id: challengeId,
    code,
  })
  return data
}

export async function acceptEmployerDpa(policy) {
  const { data } = await api.post('/employer/dpa/accept/', {
    policy_version: policy.policy_version,
    document_sha256: policy.document_sha256,
  })
  return data
}

export async function uploadEmployerBusinessDocument(file, options = {}) {
  return uploadEmployerCompanyDocument('business_registration', file, {
    ...options,
    verificationMethod: 'business_registration',
  })
}

export async function uploadEmployerDataProcessingAgreement(file, options = {}) {
  return uploadEmployerCompanyDocument('data_processing_agreement', file, options)
}

export async function previewEmployerDataProcessingAgreement(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(
    '/employer/company/documents/preview/',
    formData,
    { responseType: 'blob' },
  )
  return data
}

export async function uploadEmployerCompanyDocument(docType, file, options = {}) {
  const purpose = options.updateRequest
    ? 'employer_company_update'
    : 'employer_verification'
  const uploadSession = options.uploadSession || await prepareEmployerUpload(file, purpose, {
    onStateChange: options.onUploadStateChange,
    signal: options.signal,
  })
  const formData = new FormData()
  formData.append('doc_type', docType)
  if (uploadSession.legacy_file) formData.append('file', file)
  else formData.append('upload_session', uploadSession.public_id)
  if (options.updateRequest) formData.append('update_request', options.updateRequest)
  if (options.verificationMethod) formData.append('verification_method', options.verificationMethod)
  if (options.append) formData.append('append', 'true')
  if (options.replaceDocument) formData.append('replaces', options.replaceDocument)
  const { data } = await api.post('/employer/company/documents/', formData)
  return data
}

export async function saveEmployerCompanyTradeNameWebsite(websiteUrl, options = {}) {
  const formData = new FormData()
  formData.append('doc_type', 'trade_name_proof')
  formData.append('source_type', 'website')
  formData.append('website_url', websiteUrl)
  if (options.updateRequest) formData.append('update_request', options.updateRequest)
  if (options.replaceDocument) formData.append('replaces', options.replaceDocument)
  const { data } = await api.post('/employer/company/documents/', formData)
  return data
}

export async function getEmployerCompanyDocuments({ scope } = {}) {
  const options = scope ? { params: { scope } } : undefined
  const { data } = options
    ? await api.get('/employer/company/documents/', options)
    : await api.get('/employer/company/documents/')
  return data?.results || data || []
}

export async function getEmployerCompanyDocumentContent(document) {
  const { data } = await api.get(document.file_url, { responseType: 'blob' })
  return data
}

export async function getEmployerIndustries() {
  const { data } = await api.get('/employer/industries/all/')
  return data?.results || data || []
}

export async function searchEmployerCompanies(query) {
  const { data } = await api.get('/employer/company/search/', { params: { q: query } })
  return data?.results || data || []
}

export async function getEmployerCompanyList({ query = '', page = 1 } = {}) {
  const { data } = await api.get('/employer/company/search/', { params: { q: query, page } })
  return data
}

export async function getEmployerCompanyCatalogs() {
  const { data } = await api.get('/employer/company/catalogs/')
  return data
}

export async function createEmployerCompany(payload) {
  const { data } = await api.post('/employer/company/create/', payload)
  return data
}

// Trần kích thước server cũng áp (services/company_media.py: MEDIA_MAX_DIMENSIONS).
const LOGO_MAX_SIZE = { maxWidth: 800, maxHeight: 800 }
const PHOTO_MAX_SIZE = { maxWidth: 2400, maxHeight: 1600 }

async function uploadEmployerCompanyMedia(endpoint, original, maxSize, options = {}) {
  // Tệp đã nằm trong upload session thì không đổi được nữa.
  const file = options.uploadSession && !options.uploadSession.legacy_file
    ? original
    : await shrinkImage(original, maxSize)
  const uploadSession = options.uploadSession || await prepareEmployerUpload(
    file,
    'employer_company_update',
    {
      onStateChange: options.onUploadStateChange,
      signal: options.signal,
    },
  )
  const formData = new FormData()
  if (uploadSession.legacy_file) formData.append('file', file)
  else formData.append('upload_session', uploadSession.public_id)
  if (options.updateRequest) formData.append('update_request', options.updateRequest)
  if (options.contentChange) formData.append('content_change', options.contentChange)
  const { data } = await api.post(endpoint, formData)
  return data
}

export function uploadEmployerCompanyLogo(file, options) {
  return uploadEmployerCompanyMedia('/employer/company/logo/', file, LOGO_MAX_SIZE, options)
}

export function uploadEmployerCompanyImage(file, options) {
  return uploadEmployerCompanyMedia('/employer/company/images/', file, PHOTO_MAX_SIZE, options)
}

export function uploadEmployerCompanyCover(file, options) {
  return uploadEmployerCompanyMedia('/employer/company/cover/', file, PHOTO_MAX_SIZE, options)
}

export async function deleteEmployerCompanyCover() {
  const { data } = await api.delete('/employer/company/cover/')
  return data
}

export async function deleteEmployerCompanyLogo() {
  const { data } = await api.delete('/employer/company/logo/')
  return data
}

export async function deleteEmployerCompanyImage(id) {
  await api.delete(`/employer/company/images/${id}/`)
}

export async function getEmployerCompanyUpdateRequests({ scope } = {}) {
  const request = scope
    ? api.get('/employer/company/update-requests/', { params: { scope } })
    : api.get('/employer/company/update-requests/')
  const { data } = await request
  return data?.results || data || []
}

export async function createEmployerCompanyUpdateRequest(payload) {
  const { data } = await api.post('/employer/company/update-requests/', payload)
  return data
}

export async function getEmployerCompanyDomainClaims() {
  const { data } = await api.get('/employer/company/domain-claims/')
  return data?.results || data || []
}

export async function createEmployerCompanyDomainClaim() {
  const { data } = await api.post('/employer/company/domain-claims/', {})
  return data
}

export async function verifyEmployerCompanyDomainClaim(publicId) {
  const { data } = await api.post(
    `/employer/company/domain-claims/${encodeURIComponent(publicId)}/verify/`,
    {},
  )
  return data
}

export async function rotateEmployerCompanyDomainClaim(publicId, lockVersion) {
  const { data } = await api.post(
    `/employer/company/domain-claims/${encodeURIComponent(publicId)}/rotate/`,
    { lock_version: lockVersion },
  )
  return data
}

export async function requestEmployerCompanyDomainManualReview(
  publicId,
  { lockVersion, reason },
) {
  const { data } = await api.post(
    `/employer/company/domain-claims/${encodeURIComponent(publicId)}/request-manual-review/`,
    { lock_version: lockVersion, reason },
  )
  return data
}

export async function changeEmployerCompanyUpdateRequestLifecycle(
  publicId,
  action,
  payload,
) {
  if (!['withdraw', 'cancel'].includes(action)) {
    throw new Error('Unsupported company update lifecycle action.')
  }
  const { data } = await api.post(
    `/employer/company/update-requests/${publicId}/${action}/`,
    payload,
  )
  return data
}

/** The caller's request waiting for an owner, or `null`. */
export async function getMyCompanyJoinRequest() {
  const { data } = await api.get('/employer/company/join/mine/')
  return data
}

export async function cancelMyCompanyJoinRequest() {
  await api.delete('/employer/company/join/mine/')
}

/** Pending requests to the company the caller owns. */
export async function getCompanyJoinRequests() {
  const { data } = await api.get('/employer/company/join-requests/')
  return data
}

export async function decideCompanyJoinRequest(publicId, decision) {
  const { data } = await api.post(`/employer/company/join-requests/${publicId}/${decision}/`)
  return data
}

/** Members of the company the caller manages, with verification and activity. */
export async function getCompanyMembers({ signal } = {}) {
  const { data } = await api.get('/employer/company/members/', { signal })
  return data
}

/** People who left the company but still hold jobs or campaigns there. */
export async function getFormerCompanyMembers({ signal } = {}) {
  const { data } = await api.get('/employer/company/former-members/', { signal })
  return data
}

/** Give every job and campaign `source` holds at the company to `target` (both member_id). */
export async function handOverCompanyResources(source, target) {
  const { data } = await api.post('/employer/company/handover/', { source, target })
  return data
}

/** The company manager removes a member; rejected with `blockers` while work is running. */
export async function removeCompanyMember(memberId, reason) {
  await api.post(`/employer/company/members/${encodeURIComponent(memberId)}/remove/`, { reason })
}

/** The company manager hands the role to a verified member (`memberId` = member_id). */
export async function transferCompanyOwnership(memberId) {
  await api.post('/employer/company/ownership-transfer/', { recruiter: memberId })
}

/** Sends a join request; nothing is linked until an owner approves it. */
export async function joinEmployerCompany(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value != null) formData.append(key, value)
  })
  const { data } = await api.post('/employer/company/join/', formData)
  return data
}

export async function getEmployerRecruitmentNeeds() {
  const { data } = await api.get('/employer/recruitment-needs/')
  return data?.results || data || []
}

export async function createEmployerRecruitmentNeed(payload) {
  const { data } = await api.post('/employer/recruitment-needs/', payload)
  return data
}

export async function updateEmployerRecruitmentNeed(publicId, payload) {
  const { data } = await api.patch(`/employer/recruitment-needs/${publicId}/`, payload)
  return data
}

export async function deleteEmployerRecruitmentNeed(publicId) {
  await api.delete(`/employer/recruitment-needs/${publicId}/`)
}
