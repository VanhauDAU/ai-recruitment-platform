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

export async function getEmployerTwoFactorMethods() {
  const { data } = await api.get('/auth/two-factor/employer/methods/')
  return data
}

export async function startEmployerTotpSetup() {
  const { data } = await api.post('/auth/two-factor/employer/totp/setup/')
  return data
}

export async function confirmEmployerTotpSetup(code) {
  const { data } = await api.post('/auth/two-factor/employer/totp/confirm/', { code })
  return data
}

export async function disableEmployerTotp(code) {
  const { data } = await api.post('/auth/two-factor/employer/totp/disable/', { code })
  return data
}

export async function sendEmployerMethodDisableCode(target) {
  const { data } = await api.post('/auth/two-factor/employer/methods/disable/send/', { target })
  return data
}

export async function disableEmployerTwoFactorMethod(target, method, code) {
  const { data } = await api.post('/auth/two-factor/employer/methods/disable/', { target, method, code })
  return data
}

export async function sendEmployerBackupCodesCode() {
  const { data } = await api.post('/auth/two-factor/employer/backup-codes/send/')
  return data
}

export async function generateEmployerBackupCodes(code, method = 'email') {
  const { data } = await api.post('/auth/two-factor/employer/backup-codes/', { method, code })
  return data
}
