import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_SURFACES,
} from '@/entities/announcement'
import { simulateAnnouncementPriority } from './priority-simulator'

describe('announcement priority simulator', () => {
  it('keeps email and security above the candidate preference tier', () => {
    const result = simulateAnnouncementPriority({
      kind: ANNOUNCEMENT_KINDS.INFO,
      priority: 900,
      surfaces: [ANNOUNCEMENT_SURFACES.CANDIDATE],
    })

    expect(result.tier).toBe(6)
    expect(result.messages[0]).toMatch(/xác thực email/)
  })

  it('reports deterministic same-tier conflicts only on overlapping surfaces', () => {
    const result = simulateAnnouncementPriority(
      {
        kind: ANNOUNCEMENT_KINDS.WARNING,
        priority: 50,
        surfaces: [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE],
      },
      [
        {
          public_id: 'ann_same',
          internal_name: 'Bảo trì admin',
          kind: ANNOUNCEMENT_KINDS.MAINTENANCE,
          priority: 50,
          surfaces: [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE],
        },
        {
          public_id: 'ann_other',
          internal_name: 'Bảo trì ứng viên',
          kind: ANNOUNCEMENT_KINDS.MAINTENANCE,
          priority: 50,
          surfaces: [ANNOUNCEMENT_SURFACES.CANDIDATE],
        },
      ],
    )

    expect(result.conflicts.map((item) => item.public_id)).toEqual(['ann_same'])
    expect(result.messages).toContain(
      'Có thông báo cùng hạng và cùng priority; tất cả sẽ luân phiên, '
      + 'hệ thống dùng thời gian và mã để giữ thứ tự ổn định.',
    )
  })
})
