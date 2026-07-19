import api from '@/shared/api/client'

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

export async function uploadEmployerBusinessDocument(file) {
  return uploadEmployerCompanyDocument('business_registration', file)
}

export async function uploadEmployerDataProcessingAgreement(file) {
  return uploadEmployerCompanyDocument('data_processing_agreement', file)
}

export async function uploadEmployerCompanyDocument(docType, file, options = {}) {
  const formData = new FormData()
  formData.append('doc_type', docType)
  formData.append('file', file)
  if (options.updateRequest) formData.append('update_request', options.updateRequest)
  const { data } = await api.post('/employer/company/documents/', formData)
  return data
}

export async function saveEmployerCompanyTradeNameWebsite(websiteUrl, options = {}) {
  const formData = new FormData()
  formData.append('doc_type', 'trade_name_proof')
  formData.append('source_type', 'website')
  formData.append('website_url', websiteUrl)
  if (options.updateRequest) formData.append('update_request', options.updateRequest)
  const { data } = await api.post('/employer/company/documents/', formData)
  return data
}

export async function getEmployerCompanyDocuments() {
  const { data } = await api.get('/employer/company/documents/')
  return data?.results || data || []
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

export async function getEmployerCompany() {
  const { data } = await api.get('/employer/company/')
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

async function uploadEmployerCompanyMedia(endpoint, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(endpoint, formData)
  return data
}

export function uploadEmployerCompanyLogo(file) {
  return uploadEmployerCompanyMedia('/employer/company/logo/', file)
}

export function uploadEmployerCompanyImage(file) {
  return uploadEmployerCompanyMedia('/employer/company/images/', file)
}

export async function deleteEmployerCompanyLogo() {
  const { data } = await api.delete('/employer/company/logo/')
  return data
}

export async function deleteEmployerCompanyImage(id) {
  await api.delete(`/employer/company/images/${id}/`)
}

export async function getEmployerCompanyUpdateRequests() {
  const { data } = await api.get('/employer/company/update-requests/')
  return data?.results || data || []
}

export async function createEmployerCompanyUpdateRequest(payload) {
  const { data } = await api.post('/employer/company/update-requests/', payload)
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
