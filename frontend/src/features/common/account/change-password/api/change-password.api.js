import api from '@/shared/api/client'

// Điều kiện của phiên hiện tại: tài khoản OAuth chưa có mật khẩu phải vừa xác
// thực lại với provider. Hỏi trước để cảnh báo sớm thay vì để người dùng điền
// xong form rồi mới nhận 403.
export async function getPasswordSetupRequirements() {
  const { data } = await api.get('/auth/password/')
  return data
}

// Refresh token được gửi tự động bằng HttpOnly cookie; JavaScript không đọc nó.
export async function changeCurrentPassword(payload) {
  const { data } = await api.post('/auth/password/', payload)
  return data
}
