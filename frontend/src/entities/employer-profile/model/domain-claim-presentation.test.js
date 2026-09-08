import { describe, expect, it } from 'vitest'
import { domainClaimStatusPresentation } from './domain-claim-presentation'

describe('domainClaimStatusPresentation', () => {
  it('distinguishes a pending admin review from a pending DNS challenge', () => {
    expect(domainClaimStatusPresentation({ status: 'pending', method: 'admin_manual' })).toEqual({
      color: 'warning',
      label: 'Đang chờ duyệt thủ công',
    })
    expect(domainClaimStatusPresentation({ status: 'pending', method: 'dns_txt' })).toEqual({
      color: 'processing',
      label: 'Chờ xác minh DNS',
    })
  })
})
