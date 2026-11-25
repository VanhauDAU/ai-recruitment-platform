import api from '@/shared/api/client'

// Điều kiện của phiên hiện tại: tài khoản OAuth chưa có mật khẩu phải nhập mã
// gửi qua email. Hỏi trước để hiện ô nhập mã ngay từ đầu.
export async function getPasswordSetupRequirements() {
  const { data } = await api.get('/auth/password/')
  return data
}

// Refresh token được gửi tự động bằng HttpOnly cookie; JavaScript không đọc nó.
export async function changeCurrentPassword(payload) {
  const { data } = await api.post('/auth/password/', payload)
  return data
}

// Gửi mã 6 số tới email tài khoản (chỉ tài khoản chưa có mật khẩu); 429 kèm
// `retry_after` khi còn trong thời gian chờ gửi lại.
export async function sendPasswordSetupCode() {
  const { data } = await api.post('/auth/password/setup-code/')
  return data
}
