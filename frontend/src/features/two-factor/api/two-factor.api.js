import api from '@/shared/api/client'

// Các path dưới còn tiền tố `employer/` vì lý do lịch sử: endpoint đa phương thức
// (TOTP, mã dự phòng) ban đầu chỉ mở cho NTD, nay dùng chung với cổng quản trị.
// Đổi URL là task riêng cần ADR nên chỉ tên hàm ở FE được đặt trung tính.

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

export async function startTotpSetup() {
  const { data } = await api.post('/auth/two-factor/employer/totp/setup/')
  return data
}

export async function confirmTotpSetup(code) {
  const { data } = await api.post('/auth/two-factor/employer/totp/confirm/', { code })
  return data
}

export async function sendMfaMethodDisableCode(target) {
  const { data } = await api.post('/auth/two-factor/employer/methods/disable/send/', { target })
  return data
}

export async function disableMfaMethod(target, method, code) {
  const { data } = await api.post('/auth/two-factor/employer/methods/disable/', { target, method, code })
  return data
}

export async function sendBackupCodesCode() {
  const { data } = await api.post('/auth/two-factor/employer/backup-codes/send/')
  return data
}

export async function generateBackupCodes(code, method = 'email') {
  const { data } = await api.post('/auth/two-factor/employer/backup-codes/', { method, code })
  return data
}
