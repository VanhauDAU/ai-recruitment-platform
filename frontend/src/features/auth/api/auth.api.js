import api from '@/shared/api/client'
import { getCurrentPortal } from '@/shared/config/portals'
import { clearCurrentPortalSession, setTokens } from '@/shared/api/token-store'

export async function register({ email, password, role, full_name, captcha_token, portal }) {
  const { data } = await api.post('/auth/register/', { email, password, role, full_name, captcha_token })
  // Backend trả access trong body và đặt refresh bằng HttpOnly cookie.
  if (data.access) {
    setTokens({ access: data.access }, portal || getCurrentPortal())
  }
  return data
}

export async function registerEmployer(payload) {
  const { data } = await api.post('/employer/register/', payload)
  if (data.access) {
    setTokens({ access: data.access }, 'employer')
  }
  return data
}

// `role` giới hạn kiểm tra trong phạm vi một cổng: cùng email vẫn còn trống ở
// cổng khác (tài khoản tách theo cổng). Bỏ trống -> cổng ứng viên (mặc định BE).
export async function checkRegistrationEmail(email, { signal, role } = {}) {
  const { data } = await api.post(
    '/auth/register/email-availability/',
    { email, ...(role && { role }) },
    { signal },
  )
  return data.available === true
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

export async function changeEmail(email, currentPassword) {
  const { data } = await api.post('/auth/change-email/', {
    email,
    ...(currentPassword ? { current_password: currentPassword } : {}),
  })
  return data
}

// ---- Đặt lại mật khẩu ----

// Luôn trả về cùng một thông điệp, kể cả email chưa đăng ký (chống dò email).
// `portal` chọn đúng tài khoản của cổng (một email có thể có tài khoản ứng viên
// và NTD riêng, mỗi bên mật khẩu riêng). Mặc định suy từ cổng hiện tại.
export async function requestPasswordReset({ email, captcha_token, portal = getCurrentPortal() }) {
  const { data } = await api.post('/auth/password-reset/', { email, captcha_token, portal })
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
  if (data.access) {
    setTokens({ access: data.access }, portal || getCurrentPortal())
  }
  return data
}

export async function verifyTwoFactorLogin({ challenge, code, portal }) {
  const { data } = await api.post('/auth/two-factor/login/verify/', { challenge, code })
  setTokens({ access: data.access }, portal || getCurrentPortal())
  return data
}

export async function resendTwoFactorLogin(challenge) {
  const { data } = await api.post('/auth/two-factor/login/resend/', { challenge })
  return data
}

// ---- Social login (OAuth) ----

// URL bắt đầu luồng OAuth (full-page redirect sang backend -> provider).
export function oauthStartUrl(provider, { portal = 'main', next = '' } = {}) {
  const params = new URLSearchParams({ portal })
  if (next) params.set('next', next)
  return `${api.defaults.baseURL}/auth/oauth/${provider}/start/?${params}`
}

// Đổi one_time_code lấy access + user; refresh được đặt bằng HttpOnly cookie.
export async function completeOAuth(code, portal) {
  const { data } = await api.post('/auth/oauth/complete/', { code })
  if (data.access) {
    setTokens({ access: data.access }, portal || getCurrentPortal())
  }
  return data
}

// Chỉ xóa phiên cục bộ của cổng hiện tại (không gọi backend). Đăng xuất "đầy đủ"
// (blacklist refresh) đi qua session context: useSession().logout.
export function logout() {
  clearCurrentPortalSession()
}
