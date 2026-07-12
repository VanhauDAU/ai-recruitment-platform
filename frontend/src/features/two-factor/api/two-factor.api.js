import api from '@/shared/api/client'

export async function sendTwoFactorSetupCode() {
  const { data } = await api.post('/auth/two-factor/setup/send/')
  return data
}

export async function confirmTwoFactorSetup(code) {
  const { data } = await api.post('/auth/two-factor/setup/confirm/', { code })
  return data
}

export async function sendTwoFactorDisableCode() {
  const { data } = await api.post('/auth/two-factor/disable/send/')
  return data
}

export async function confirmTwoFactorDisable(code) {
  const { data } = await api.post('/auth/two-factor/disable/confirm/', { code })
  return data
}
