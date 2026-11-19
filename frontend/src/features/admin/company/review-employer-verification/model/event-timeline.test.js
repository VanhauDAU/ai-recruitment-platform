import { describe, expect, it } from 'vitest'
import { buildVerificationTimeline } from './event-timeline'

const document = {
  public_id: 'doc_1',
  doc_type_label: 'Giấy đăng ký doanh nghiệp',
  file_name: 'dang-ky.webp',
}

function event(createdAt, payload = {}) {
  return {
    public_id: `event_${createdAt}`,
    event_type: 'sensitive_viewed',
    event_type_label: 'Đã xem dữ liệu nhạy cảm',
    actor_email: 'admin@example.com',
    created_at: createdAt,
    payload: {
      document_public_id: document.public_id,
      action: 'preview',
      audit_version: 2,
      ...payload,
    },
  }
}

describe('verification event timeline', () => {
  it('groups duplicate technical preview requests within one minute', () => {
    const result = buildVerificationTimeline([
      event('2026-07-26T11:35:30Z'),
      event('2026-07-26T11:35:05Z'),
    ], [document])

    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(2)
    expect(result[0].title).toBe('Đã xem giấy tờ nhạy cảm')
    expect(result[0].documentLabel).toContain('dang-ky.webp')
  })

  it('keeps preview and download as separate audit actions', () => {
    const result = buildVerificationTimeline([
      event('2026-07-26T11:35:30Z', { action: 'download' }),
      event('2026-07-26T11:35:10Z'),
    ], [document])

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Đã tải giấy tờ nhạy cảm')
    expect(result[1].title).toBe('Đã xem giấy tờ nhạy cảm')
  })

  it('labels historical ambiguous events as access instead of download', () => {
    const legacy = event('2026-07-26T11:35:30Z')
    delete legacy.payload.audit_version

    expect(buildVerificationTimeline([legacy], [document])[0].title)
      .toBe('Đã truy cập giấy tờ nhạy cảm')
  })
})
