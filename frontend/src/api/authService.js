import api from './api'

export async function register({ email, password, role, full_name, captcha_token }) {
  const { data } = await api.post('/auth/register/', { email, password, role, full_name, captcha_token })
  return data
}

export async function login({ email, password, captcha_token }) {
  const { data } = await api.post('/auth/login/', { email, password, captcha_token })
  localStorage.setItem('access_token', data.access)
  localStorage.setItem('refresh_token', data.refresh)
  return data
}

export async function me() {
  const { data } = await api.get('/auth/me/')
  return data
}

export function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function getAccessToken() {
  return localStorage.getItem('access_token')
}
