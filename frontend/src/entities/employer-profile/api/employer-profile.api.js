import api from '@/shared/api/client'
import { prepareCleanUpload } from '@/shared/api/upload-session'

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

export async function checkEmployerPhoneAvailability(phone) {
  const { data } = await api.get('/employer/phone/check/', { params: { phone } })
  return data
}

export async function sendEmployerPhoneOtp(phone, password) {
  const { data } = await api.post('/employer/phone/send-otp/', { phone, password })
  return data
}

export async function verifyEmployerPhoneOtp(code) {
  const { data } = await api.post('/employer/phone/verify/', { code })
  return data
}

export async function acceptEmployerDpa() {
  const { data } = await api.post('/employer/dpa/accept/')
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

async function uploadEmployerCompanyMedia(endpoint, file, options = {}) {
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
  const { data } = await api.post(endpoint, formData)
  return data
}

export function uploadEmployerCompanyLogo(file, options) {
  return uploadEmployerCompanyMedia('/employer/company/logo/', file, options)
}

export function uploadEmployerCompanyImage(file, options) {
  return uploadEmployerCompanyMedia('/employer/company/images/', file, options)
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

export async function joinEmployerCompany(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value != null) formData.append(key, value)
  })
  const { data } = await api.post('/employer/company/join/', formData)
  return data
}

export async function getEmployerRecruitmentNeed() {
  const { data } = await api.get('/employer/consulting-need/')
  return data
}

export async function saveEmployerRecruitmentNeed(payload) {
  const { data } = await api.post('/employer/consulting-need/', payload)
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
