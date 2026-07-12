import {
  clearSession as clearPersistedSession,
  getAccessToken as readAccessToken,
  setTokens,
} from '@/shared/api/token-store'

export function getAccessToken(portal) {
  return readAccessToken(portal)
}

export function setSession(tokens, portal) {
  setTokens(tokens, portal)
}

export function clearSession(portal) {
  clearPersistedSession(portal)
}
