import api from './api'
import { getAuthStorageKeys, getCurrentPortal } from '../config/portals'

export async function register({ email, password, role, full_name, captcha_token, portal }) {
  const { data } = await api.post('/auth/register/', { email, password, role, full_name, captcha_token })
  // Backend trả về access/refresh -> đăng nhập ngay để dẫn thẳng vào trang (chưa xác thực email).
  if (data.access && data.refresh) {
    const { access, refresh } = getAuthStorageKeys(portal || getCurrentPortal())
    localStorage.setItem(access, data.access)
    localStorage.setItem(refresh, data.refresh)
  }
  return data
}

// Xác thực email
export async function sendVerificationEmail() {
  const { data } = await api.post('/auth/verify/send/')
  return data
}

export async function confirmVerification(token) {
  const { data } = await api.post('/auth/verify/confirm/', { token })
  return data
}

export async function changeEmail(email) {
  const { data } = await api.post('/auth/change-email/', { email })
  return data
}

// ---- Đặt lại mật khẩu ----

// Luôn trả về cùng một thông điệp, kể cả email chưa đăng ký (chống dò email).
export async function requestPasswordReset({ email, captcha_token }) {
  const { data } = await api.post('/auth/password-reset/', { email, captcha_token })
  return data
}

// Kiểm tra link còn hiệu lực trước khi hiện form (không tiêu token).
export async function validatePasswordResetToken(token) {
  const { data } = await api.get('/auth/password-reset/validate/', { params: { token } })
  return data
}

export async function confirmPasswordReset({ token, password }) {
  const { data } = await api.post('/auth/password-reset/confirm/', { token, password })
  return data
}

export async function login({ email, password, captcha_token, portal }) {
  const { data } = await api.post('/auth/login/', { email, password, captcha_token, ...(portal && { portal }) })
  const { access, refresh } = getAuthStorageKeys(portal || getCurrentPortal())
  localStorage.setItem(access, data.access)
  localStorage.setItem(refresh, data.refresh)
  return data
}

// ---- Social login (OAuth) ----

// URL bắt đầu luồng OAuth (full-page redirect sang backend -> provider).
export function oauthStartUrl(provider, { portal = 'main', next = '' } = {}) {
  const params = new URLSearchParams({ portal })
  if (next) params.set('next', next)
  return `${api.defaults.baseURL}/auth/oauth/${provider}/start/?${params}`
}

// Đổi one_time_code (backend redirect về kèm ?code=) lấy JWT + user.
export async function completeOAuth(code, portal) {
  const { data } = await api.post('/auth/oauth/complete/', { code })
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
