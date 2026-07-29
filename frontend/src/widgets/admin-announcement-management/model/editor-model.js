import {
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_KINDS,
  DEFAULT_ADMIN_ANNOUNCEMENT_REVISION,
  latestAnnouncementRevision,
  normalizeAnnouncementUrl,
} from '@/entities/announcement'

function lines(value) {
  if (Array.isArray(value)) return value.join('\n')
  return value || ''
}

function splitLines(value) {
  return [...new Set(
    String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
  )]
}

function isoDate(value) {
  if (!value) return null
  if (typeof value.toISOString === 'function') return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function announcementEditorValues(detail) {
  const revision = detail
    ? latestAnnouncementRevision(detail)
    : DEFAULT_ADMIN_ANNOUNCEMENT_REVISION
  return {
    internal_name: detail?.internal_name || '',
    ...revision,
    include_path_prefixes: lines(revision.include_path_prefixes),
    exclude_path_prefixes: lines(revision.exclude_path_prefixes),
  }
}

export function announcementRevisionPayload(values) {
  return {
    message_vi: values.message_vi?.trim(),
    message_en: values.message_en?.trim() || '',
    badge_vi: values.badge_vi?.trim() || '',
    badge_en: values.badge_en?.trim() || '',
    icon: values.icon,
    cta_label_vi: values.cta_label_vi?.trim() || '',
    cta_label_en: values.cta_label_en?.trim() || '',
    cta_url: values.cta_url?.trim() || '',
    kind: values.kind,
    surfaces: values.surfaces || [],
    auth_audiences: values.auth_audiences || [],
    roles: values.roles || [],
    include_path_prefixes: splitLines(values.include_path_prefixes),
    exclude_path_prefixes: splitLines(values.exclude_path_prefixes),
    starts_at: isoDate(values.starts_at),
    ends_at: isoDate(values.ends_at),
    priority: Number(values.priority),
    animation: values.animation,
    display_seconds: Number(values.display_seconds),
    dismiss_mode: values.dismiss_mode,
    snooze_seconds: values.dismiss_mode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE
      ? Number(values.snooze_seconds)
      : null,
  }
}

export function announcementEditorIssues(values) {
  const issues = []
  const revision = announcementRevisionPayload(values)
  if (!values.internal_name?.trim()) issues.push('Nhập tên vận hành.')
  if (!revision.message_vi) issues.push('Nội dung tiếng Việt là bắt buộc.')
  if (!revision.surfaces.length) issues.push('Chọn ít nhất một surface.')
  if (!revision.auth_audiences.length) issues.push('Chọn ít nhất một nhóm người xem.')
  if (revision.cta_label_vi || revision.cta_url) {
    if (!revision.cta_label_vi || !revision.cta_url) {
      issues.push('Nhãn CTA tiếng Việt và URL phải được cấu hình cùng nhau.')
    } else if (!normalizeAnnouncementUrl(revision.cta_url)) {
      issues.push('URL nội bộ phải bắt đầu bằng /; URL ngoài phải là HTTPS an toàn.')
    }
  }
  if (
    revision.starts_at
    && revision.ends_at
    && new Date(revision.starts_at) >= new Date(revision.ends_at)
  ) {
    issues.push('Thời gian kết thúc phải sau thời gian bắt đầu.')
  }
  if (revision.kind === ANNOUNCEMENT_KINDS.CRITICAL) {
    if (!revision.ends_at) issues.push('Thông báo critical bắt buộc có thời gian kết thúc.')
    if (revision.dismiss_mode !== ANNOUNCEMENT_DISMISS_MODES.LOCKED) {
      issues.push('Thông báo critical không thể dismiss.')
    }
  }
  if (
    revision.dismiss_mode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE
    && (!revision.snooze_seconds || revision.snooze_seconds < 60)
  ) {
    issues.push('Thời gian snooze tối thiểu là 60 giây.')
  }
  return issues
}
