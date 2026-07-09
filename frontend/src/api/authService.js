import api from './api'
import { getAuthStorageKeys, getCurrentPortal } from '../config/portals'

export async function register({ email, password, role, full_name, captcha_token }) {
  const { data } = await api.post('/auth/register/', { email, password, role, full_name, captcha_token })
  return data
}

export async function login({ email, password, captcha_token, portal }) {
  const { data } = await api.post('/auth/login/', { email, password, captcha_token, ...(portal && { portal }) })
  const { access, refresh } = getAuthStorageKeys(portal || getCurrentPortal())
  localStorage.setItem(access, data.access)
  localStorage.setItem(refresh, data.refresh)
  return data
}

export async function me() {
  const { data } = await api.get('/auth/me/')
  return data
}

export function logout(portal = getCurrentPortal()) {
  const { access, refresh } = getAuthStorageKeys(portal)
  localStorage.removeItem(access)
  localStorage.removeItem(refresh)
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function getAccessToken(portal = getCurrentPortal()) {
  const { access } = getAuthStorageKeys(portal)
  return localStorage.getItem(access)
}
