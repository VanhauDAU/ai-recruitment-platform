import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_SURFACES,
  DEFAULT_ADMIN_ANNOUNCEMENT_REVISION,
} from '@/entities/announcement'
import {
  announcementEditorIssues,
  announcementRevisionPayload,
} from './editor-model'

function values(overrides = {}) {
  return {
    internal_name: 'Thông báo test',
    ...DEFAULT_ADMIN_ANNOUNCEMENT_REVISION,
    ...overrides,
    message_vi: overrides.message_vi || 'Nội dung',
    include_path_prefixes: '/viec-lam\n/viec-lam',
    exclude_path_prefixes: '/dang-nhap',
  }
}

describe('announcement editor model', () => {
  it('deduplicates route prefixes and emits UTC payloads', () => {
    const payload = announcementRevisionPayload(values({
      starts_at: new Date('2026-08-01T01:00:00Z'),
    }))

    expect(payload.include_path_prefixes).toEqual(['/viec-lam'])
    expect(payload.starts_at).toBe('2026-08-01T01:00:00.000Z')
  })

  it('rejects unsafe URLs and incomplete CTA configuration', () => {
    expect(announcementEditorIssues(values({
      cta_label_vi: 'Xem',
      cta_url: 'javascript:alert(1)',
    }))).toEqual([
      'URL nội bộ phải bắt đầu bằng /; URL ngoài phải là HTTPS an toàn.',
    ])
  })

  it('enforces critical end time and locked dismissal', () => {
    const issues = announcementEditorIssues(values({
      kind: ANNOUNCEMENT_KINDS.CRITICAL,
      surfaces: [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE],
      ends_at: null,
      dismiss_mode: ANNOUNCEMENT_DISMISS_MODES.CLOSE,
    }))

    expect(issues).toContain('Thông báo critical bắt buộc có thời gian kết thúc.')
    expect(issues).toContain('Thông báo critical không thể dismiss.')
  })
})
