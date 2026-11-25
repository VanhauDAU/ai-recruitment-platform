import { describe, expect, it } from 'vitest'
import { formatFlashBadgeStats } from './job-detail-presentation'

describe('formatFlashBadgeStats', () => {
  it('reads the real response numbers behind the flash badge', () => {
    expect(formatFlashBadgeStats({ response_rate: 92, avg_response_hours: 36 })).toBe(
      'Nhà tuyển dụng phản hồi 92% hồ sơ, trung bình 1,5 ngày',
    )
    expect(formatFlashBadgeStats({ response_rate: 100, avg_response_hours: 5.4 })).toBe(
      'Nhà tuyển dụng phản hồi 100% hồ sơ, trung bình 5 giờ',
    )
    expect(formatFlashBadgeStats(null)).toBe('')
  })
})
