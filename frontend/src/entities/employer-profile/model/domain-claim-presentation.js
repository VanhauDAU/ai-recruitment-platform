const STATUS_PRESENTATION = {
  pending: { color: 'processing', label: 'Chờ xác minh DNS' },
  dns_pending: { color: 'processing', label: 'Chờ xác minh DNS' },
  manual_review: { color: 'warning', label: 'Đang chờ duyệt thủ công' },
  pending_manual_review: { color: 'warning', label: 'Đang chờ duyệt thủ công' },
  verified: { color: 'success', label: 'Đã xác minh' },
  grace: { color: 'warning', label: 'Cần khôi phục bản ghi DNS' },
  grace_period: { color: 'warning', label: 'Cần khôi phục bản ghi DNS' },
  revoked: { color: 'error', label: 'Đã thu hồi' },
  expired: { color: 'default', label: 'Đã hết hạn' },
  rejected: { color: 'error', label: 'Không được duyệt' },
  legacy_inferred: { color: 'warning', label: 'Cần xác minh lại' },
}

export function domainClaimStatusPresentation(value) {
  const claim = typeof value === 'object' ? value : null
  const status = claim?.status || value
  if (claim?.method === 'admin_manual' && status === 'pending') {
    return { color: 'warning', label: 'Đang chờ duyệt thủ công' }
  }
  return STATUS_PRESENTATION[status] || { color: 'default', label: status || 'Chưa xác minh' }
}

export function domainClaimAllows(claim, action) {
  const allowed = Array.isArray(claim?.allowed_actions) ? claim.allowed_actions : []
  const aliases = new Set([
    action,
    action.replaceAll('_', '-'),
    action.replaceAll('-', '_'),
  ])
  return allowed.some((item) => aliases.has(item))
}

export function formatDomainClaimDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}
