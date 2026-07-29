import {
  ANNOUNCEMENT_ANIMATIONS,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_LIFECYCLE_STATES,
  ANNOUNCEMENT_ROLES,
  ANNOUNCEMENT_SURFACES,
} from '@/entities/announcement'

function options(labels) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

export const KIND_LABELS = Object.freeze({
  [ANNOUNCEMENT_KINDS.CRITICAL]: 'Sự cố nghiêm trọng',
  [ANNOUNCEMENT_KINDS.SECURITY]: 'Bảo mật & xác thực',
  [ANNOUNCEMENT_KINDS.COMPLIANCE]: 'Pháp lý & tuân thủ',
  [ANNOUNCEMENT_KINDS.WARNING]: 'Cảnh báo vận hành',
  [ANNOUNCEMENT_KINDS.MAINTENANCE]: 'Bảo trì',
  [ANNOUNCEMENT_KINDS.INFO]: 'Thông tin',
  [ANNOUNCEMENT_KINDS.SUCCESS]: 'Thành công',
  [ANNOUNCEMENT_KINDS.EVENT]: 'Sự kiện',
  [ANNOUNCEMENT_KINDS.FEATURE]: 'Tính năng mới',
})

export const SURFACE_LABELS = Object.freeze({
  [ANNOUNCEMENT_SURFACES.CANDIDATE]: 'Ứng viên',
  [ANNOUNCEMENT_SURFACES.EMPLOYER_MARKETING]: 'Marketing NTD',
  [ANNOUNCEMENT_SURFACES.EMPLOYER_WORKSPACE]: 'Workspace NTD',
  [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE]: 'Workspace quản trị',
})

export const AUDIENCE_LABELS = Object.freeze({
  [ANNOUNCEMENT_AUDIENCES.GUEST]: 'Khách chưa đăng nhập',
  [ANNOUNCEMENT_AUDIENCES.AUTHENTICATED]: 'Đã đăng nhập',
})

export const ROLE_LABELS = Object.freeze({
  [ANNOUNCEMENT_ROLES.CANDIDATE]: 'Ứng viên',
  [ANNOUNCEMENT_ROLES.EMPLOYER]: 'Nhà tuyển dụng',
  [ANNOUNCEMENT_ROLES.ADMIN]: 'Quản trị viên',
})

export const STATUS_LABELS = Object.freeze({
  [ANNOUNCEMENT_LIFECYCLE_STATES.DRAFT]: 'Bản nháp',
  [ANNOUNCEMENT_LIFECYCLE_STATES.PUBLISHED]: 'Đã phát hành',
  [ANNOUNCEMENT_LIFECYCLE_STATES.PAUSED]: 'Đang tạm dừng',
  [ANNOUNCEMENT_LIFECYCLE_STATES.ARCHIVED]: 'Đã lưu trữ',
  scheduled: 'Đã lên lịch',
  live: 'Đang hiển thị',
  ended: 'Đã kết thúc',
})

export const STATUS_COLORS = Object.freeze({
  draft: 'default',
  published: 'blue',
  paused: 'gold',
  archived: 'default',
  scheduled: 'purple',
  live: 'green',
  ended: 'red',
})

export const ICON_LABELS = Object.freeze({
  [ANNOUNCEMENT_ICONS.ALERT_TRIANGLE]: 'Cảnh báo',
  [ANNOUNCEMENT_ICONS.BELL]: 'Chuông',
  [ANNOUNCEMENT_ICONS.CHECK_CIRCLE]: 'Hoàn tất',
  [ANNOUNCEMENT_ICONS.INFO]: 'Thông tin',
  [ANNOUNCEMENT_ICONS.LOCK]: 'Khóa',
  [ANNOUNCEMENT_ICONS.MEGAPHONE]: 'Loa',
  [ANNOUNCEMENT_ICONS.SHIELD]: 'Khiên',
  [ANNOUNCEMENT_ICONS.SPARKLES]: 'Lấp lánh',
  [ANNOUNCEMENT_ICONS.WRENCH]: 'Công cụ',
})

export const ANIMATION_LABELS = Object.freeze({
  [ANNOUNCEMENT_ANIMATIONS.SLIDE]: 'Trượt dọc + mờ',
  [ANNOUNCEMENT_ANIMATIONS.FADE]: 'Mờ chuyển cảnh',
  [ANNOUNCEMENT_ANIMATIONS.STATIC]: 'Tĩnh',
})

export const DISMISS_LABELS = Object.freeze({
  [ANNOUNCEMENT_DISMISS_MODES.LOCKED]: 'Không thể đóng',
  [ANNOUNCEMENT_DISMISS_MODES.CLOSE]: 'Cho phép đóng',
  [ANNOUNCEMENT_DISMISS_MODES.SNOOZE]: 'Cho phép nhắc lại sau',
})

export const KIND_OPTIONS = options(KIND_LABELS)
export const SURFACE_OPTIONS = options(SURFACE_LABELS)
export const AUDIENCE_OPTIONS = options(AUDIENCE_LABELS)
export const ROLE_OPTIONS = options(ROLE_LABELS)
export const STATUS_OPTIONS = options(STATUS_LABELS)
  .filter(({ value }) => Object.values(ANNOUNCEMENT_LIFECYCLE_STATES).includes(value))
export const ICON_OPTIONS = options(ICON_LABELS)
export const ANIMATION_OPTIONS = options(ANIMATION_LABELS)
export const DISMISS_OPTIONS = options(DISMISS_LABELS)
