import api from '@/shared/api/client'

const REQUEST_CONFIG = { withCredentials: true }

export async function getConsent() {
  const { data } = await api.get('/privacy/consent/', REQUEST_CONFIG)
  return data.consent
}

export async function saveConsent(consent) {
  const { data } = await api.post('/privacy/consent/', consent, REQUEST_CONFIG)
  return data
}
