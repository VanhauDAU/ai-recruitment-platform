import api from '@/shared/api/client'
import { getCurrentPortal } from '@/config/portals'
import { setTokens } from '@/shared/api/tokenStore'

export async function verifyTwoFactorLogin({ challenge, code, portal }) {
  const { data } = await api.post('/auth/two-factor/login/verify/', { challenge, code })
  setTokens({ access: data.access, refresh: data.refresh }, portal || getCurrentPortal())
  return data
}

export async function resendTwoFactorLogin(challenge) {
  const { data } = await api.post('/auth/two-factor/login/resend/', { challenge })
  return data
}

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
