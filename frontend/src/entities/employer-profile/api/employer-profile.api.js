import api from '@/shared/api/client'

export async function getEmployerProfile() {
  const { data } = await api.get('/employer/me/')
  return data
}

export async function completeEmployerRegistration(payload) {
  const { data } = await api.post('/employer/onboarding/registration/', payload)
  return data
}

export async function sendEmployerPhoneOtp(phone) {
  const { data } = await api.post('/employer/phone/send-otp/', { phone })
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

export async function uploadEmployerCompanyDocument(docType, file) {
  const formData = new FormData()
  formData.append('doc_type', docType)
  formData.append('file', file)
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

export async function createEmployerCompany(payload) {
  const { data } = await api.post('/employer/company/create/', payload)
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
