import { getIntlLocale } from '@/shared/config/i18n'
export const ACCOUNT_ROLE_LABELS = {
  admin: 'Admin',
  candidate: 'Ứng viên',
  employer: 'Nhà tuyển dụng',
}

export const ACCOUNT_STATUS_LABELS = {
  active: 'Đang hoạt động',
  banned: 'Đã cấm',
  inactive: 'Tạm khóa',
  pending: 'Chờ kích hoạt',
}

export const INVITATION_STATUS_LABELS = {
  accepted: 'Đã chấp nhận',
  expired: 'Hết hạn',
  pending: 'Đang chờ',
  revoked: 'Đã thu hồi',
}

export function adminTierLabel(adminAccess) {
  return adminAccess?.is_superuser ? 'Superuser' : 'Quản trị viên'
}

export function formatAdminDate(value, fallback = 'Chưa có') {
  if (!value) return fallback
  return new Intl.DateTimeFormat(getIntlLocale(), {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function accountSubtitle(account) {
  if (account.role === 'admin') return adminTierLabel(account.admin_access)
  if (account.role === 'employer') {
    return account.context?.company?.name || account.context?.position_title || 'Nhà tuyển dụng'
  }
  return account.context?.current_position || account.context?.headline || 'Ứng viên'
}
