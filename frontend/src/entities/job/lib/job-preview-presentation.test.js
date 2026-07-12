import { describe, expect, it } from 'vitest'
import {
  jobContentLines,
  previewBenefitLines,
  previewLocationLines,
  previewScheduleLines,
} from './job-preview-presentation'

describe('job preview presentation', () => {
  it('converts rich job content to readable text lines', () => {
    expect(jobContentLines('<p>Phát triển sản phẩm</p><ul><li>Phối hợp với đội thiết kế</li></ul>')).toEqual([
      'Phát triển sản phẩm',
      'Phối hợp với đội thiết kế',
    ])
  })

  it('formats full workplace addresses', () => {
    expect(previewLocationLines({
      job_locations: [{
        address_detail: '12 Nguyễn Huệ',
        location_name: 'Phường Sài Gòn',
        location_level: 'ward',
        province_name: 'TP. Hồ Chí Minh',
      }],
    })).toEqual(['12 Nguyễn Huệ, Phường Sài Gòn, TP. Hồ Chí Minh'])
  })

  it('formats structured schedules and their notes', () => {
    expect(previewScheduleLines({
      work_schedules: [{
        weekday_from: 2,
        weekday_to: 6,
        start_time: '08:30:00',
        end_time: '17:30:00',
        note: 'Nghỉ trưa 1 giờ',
      }],
      work_schedule_note: 'Linh hoạt 1 ngày làm từ xa',
    })).toEqual([
      'Thứ 3 - Thứ 7, 08:30 - 17:30 (Nghỉ trưa 1 giờ)',
      'Linh hoạt 1 ngày làm từ xa',
    ])
  })

  it('uses normalized benefits when the free-text benefit is empty', () => {
    expect(previewBenefitLines({
      benefits: '',
      job_benefits: [{ benefit_name: 'Bảo hiểm sức khỏe', note: 'Cho cả gia đình' }],
    })).toEqual(['Bảo hiểm sức khỏe: Cho cả gia đình'])
  })
})
