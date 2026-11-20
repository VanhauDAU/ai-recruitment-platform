// Sổ đăng ký "có thay đổi chưa lưu" cho cả trang. Form nào đang dở đăng ký một
// hàm kiểm tra; trang:
// - cảnh báo của trình duyệt khi tải lại/đóng tab (beforeunload);
// - cho thao tác chủ động tải lại (đổi ngôn ngữ) hỏi bằng hộp thoại trong app
//   trước, rồi bỏ qua cảnh báo trình duyệt để không hỏi hai lần.
const checks = new Set()
let bypassUnload = false

function warnBeforeUnload(event) {
  if (bypassUnload || !hasUnsavedChanges()) return
  event.preventDefault()
  event.returnValue = ''
}

export function hasUnsavedChanges() {
  for (const check of checks) {
    if (check()) return true
  }
  return false
}

/** Đăng ký hàm kiểm tra; trả về hàm hủy đăng ký. */
export function registerUnsavedChanges(check) {
  if (checks.size === 0) window.addEventListener('beforeunload', warnBeforeUnload)
  checks.add(check)
  return () => {
    checks.delete(check)
    if (checks.size === 0) window.removeEventListener('beforeunload', warnBeforeUnload)
  }
}

/**
 * Lần rời trang kế tiếp không cảnh báo nữa (người dùng đã xác nhận trong app).
 * Trả về hàm khôi phục, dùng khi thao tác tải lại không diễn ra.
 */
export function allowNextUnload() {
  bypassUnload = true
  return () => {
    bypassUnload = false
  }
}
