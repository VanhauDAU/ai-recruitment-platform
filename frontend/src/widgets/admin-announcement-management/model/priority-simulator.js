import {
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_PRIORITY_TIERS,
} from '@/entities/announcement'
import { KIND_LABELS, SURFACE_LABELS } from './announcement-options'

function overlaps(left = [], right = []) {
  return left.some((value) => right.includes(value))
}

export function simulateAnnouncementPriority(values, announcements = []) {
  const tier = ANNOUNCEMENT_PRIORITY_TIERS[values.kind] || 6
  const priority = Number(values.priority) || 0
  const conflicts = announcements
    .filter((item) => item.kind && overlaps(values.surfaces, item.surfaces))
    .map((item) => ({
      ...item,
      tier: ANNOUNCEMENT_PRIORITY_TIERS[item.kind] || 6,
    }))
    .filter((item) => item.tier <= tier)
    .sort((left, right) => left.tier - right.tier || (right.priority || 0) - priority)

  const messages = []
  if (tier > 2) {
    messages.push('Cảnh báo xác thực email/bảo mật sẽ luôn được ưu tiên hơn thông báo này.')
  }
  if (values.kind === ANNOUNCEMENT_KINDS.CRITICAL) {
    messages.push('Critical sẽ vượt mọi label hệ thống và không cho phép người dùng đóng.')
  }
  if (conflicts.some((item) => item.tier === tier && Number(item.priority) === priority)) {
    messages.push(
      'Có thông báo cùng hạng và cùng priority; tất cả sẽ luân phiên, '
      + 'hệ thống dùng thời gian và mã để giữ thứ tự ổn định.',
    )
  }

  return {
    tier,
    tierLabel: `Hạng ${tier} · ${KIND_LABELS[values.kind] || values.kind}`,
    surfaces: (values.surfaces || []).map((surface) => SURFACE_LABELS[surface] || surface),
    conflicts,
    messages,
  }
}
