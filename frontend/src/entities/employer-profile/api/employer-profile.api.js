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

export async function getEmployerRecruitmentNeed() {
  const { data } = await api.get('/employer/consulting-need/')
  return data
}

export async function saveEmployerRecruitmentNeed(payload) {
  const { data } = await api.post('/employer/consulting-need/', payload)
  return data
}
