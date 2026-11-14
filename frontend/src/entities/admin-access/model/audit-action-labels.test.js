import { describe, expect, it } from 'vitest'
import { auditActionLabel } from './audit-action-labels'

describe('audit action labels', () => {
  it('names company page and company report decisions in Vietnamese', () => {
    expect(auditActionLabel('apply_company_page_hold')).toBe('Tạm ẩn trang công ty')
    expect(auditActionLabel('release_company_page_hold')).toBe('Khôi phục trang công ty')
    expect(auditActionLabel('resolve_company_report')).toBe('Kết luận báo cáo công ty')
    expect(auditActionLabel('reverse_company_report')).toBe('Gỡ kết luận báo cáo công ty')
  })

  it('falls back to the raw code for an action without a label', () => {
    expect(auditActionLabel('some_future_action')).toBe('some_future_action')
  })
})
