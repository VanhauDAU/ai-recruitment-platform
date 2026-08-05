/**
 * Nhãn tiếng Việt cho `action` của AdminAccessAuditLog.
 *
 * Danh sách này CÓ THỂ thiếu so với backend (action mới được thêm mà chưa cập
 * nhật ở đây) nên `auditActionLabel` luôn fallback về mã gốc thay vì để trống —
 * nhật ký không được biến mất chỉ vì thiếu bản dịch.
 */
export const AUDIT_ACTION_LABELS = {
  // Thao tác bảo mật do chính tài khoản thực hiện (tiền tố `self_`).
  self_password_change: 'Đổi mật khẩu',
  self_profile_update: 'Cập nhật hồ sơ',
  self_mfa_enable: 'Bật xác thực hai yếu tố',
  self_mfa_disable: 'Tắt xác thực hai yếu tố',
  self_backup_codes_regenerate: 'Tạo lại mã dự phòng',
  self_session_revoke: 'Đăng xuất một thiết bị',
  self_session_revoke_others: 'Đăng xuất các thiết bị khác',

  // Thao tác phân quyền (RBAC).
  assign_membership: 'Gán chức danh',
  revoke_membership: 'Thu hồi chức danh',
  set_primary_membership: 'Đặt phòng ban chính',
  create_department: 'Tạo phòng ban',
  update_department: 'Sửa phòng ban',
  set_department_active: 'Đổi trạng thái phòng ban',
  restore_system_department: 'Khôi phục phòng ban mặc định',
  create_role: 'Tạo chức danh',
  update_role: 'Sửa chức danh',
  set_role_active: 'Đổi trạng thái chức danh',
  set_role_permissions: 'Cập nhật quyền của chức danh',
  restore_system_role: 'Khôi phục chức danh mặc định',
  sync_permission_catalog: 'Đồng bộ danh mục quyền',

  // Quản lý tài khoản và cấp phát Admin.
  create_admin_invitation: 'Mời tài khoản Admin',
  update_admin_invitation: 'Đổi chức danh lời mời',
  resend_admin_invitation: 'Gửi lại lời mời Admin',
  revoke_admin_invitation: 'Thu hồi lời mời Admin',
  accept_admin_invitation: 'Chấp nhận lời mời Admin',
  create_provisioning_scope: 'Tạo quy tắc mời Admin',
  set_provisioning_scope_active: 'Đổi trạng thái quy tắc mời Admin',
  update_account_profile: 'Cập nhật hồ sơ tài khoản',
  change_account_status: 'Đổi trạng thái tài khoản (legacy)',
  temporarily_suspend_account: 'Tạm khóa tài khoản',
  ban_account: 'Cấm tài khoản',
  begin_account_reactivation: 'Bắt đầu khôi phục tài khoản bị cấm',
  reactivate_account: 'Mở lại tài khoản',
  release_account_resource_hold: 'Gỡ policy hold tài nguyên',
  change_account_email: 'Khôi phục email đăng nhập',
  reset_account_mfa: 'Đặt lại xác thực đa yếu tố',
  revoke_account_sessions: 'Thu hồi phiên tài khoản',
  send_account_password_reset: 'Gửi đặt lại mật khẩu',
  resend_account_verification: 'Gửi lại xác minh email',

  // Thao tác từ management command / seed.
  bootstrap_mfa: 'Khởi tạo MFA qua CLI',
  mark_email_verified: 'Đánh dấu email đã xác minh',
}

export const AUDIT_SOURCE_LABELS = {
  api: 'Giao diện quản trị',
  management_command: 'Dòng lệnh',
  seed: 'Khởi tạo hệ thống',
}

export function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action
}

export function auditSourceLabel(source) {
  return AUDIT_SOURCE_LABELS[source] || source
}

/** Các action tự phục vụ — dùng cho bộ lọc "Chỉ thao tác bảo mật". */
export const SELF_SERVICE_ACTIONS = Object.keys(AUDIT_ACTION_LABELS).filter((code) =>
  code.startsWith('self_'),
)
