import { describe, expect, it } from 'vitest'
import {
  documentStatusMeta,
  EMPLOYER_VERIFICATION_STATUS,
  verificationStatusMeta,
  VERIFICATION_CHECK_LABELS,
} from './presentation'

describe('employer verification presentation', () => {
  it('provides Vietnamese labels for every workflow status', () => {
    expect(Object.keys(EMPLOYER_VERIFICATION_STATUS)).toEqual([
      'draft',
      'pending',
      'in_review',
      'changes_requested',
      'rejected',
      'approved',
      'revoked',
      'expired',
    ])
    expect(verificationStatusMeta('changes_requested').label).toBe('Cần bổ sung')
    expect(verificationStatusMeta('revoked').label).toBe('Đã thu hồi')
    expect(documentStatusMeta('approved').label).toBe('Đã duyệt')
  })

  it('keeps the shared admin and employer checklist at nine explicit steps', () => {
    expect(Object.keys(VERIFICATION_CHECK_LABELS)).toHaveLength(9)
    expect(VERIFICATION_CHECK_LABELS.case_approved).toBeUndefined()
  })

  it('renders an unknown backend status without exposing an empty label', () => {
    expect(verificationStatusMeta('archived')).toEqual({
      label: 'archived',
      color: 'default',
    })
  })
})
