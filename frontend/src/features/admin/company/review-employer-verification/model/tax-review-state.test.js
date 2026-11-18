import { describe, expect, it } from 'vitest'
import { getTaxReviewState } from './tax-review-state'

describe('getTaxReviewState', () => {
  it('blocks approval while the provider lookup is pending', () => {
    expect(getTaxReviewState({ status: 'pending' })).toMatchObject({
      blocksApproval: true,
      requiresManualApproval: false,
    })
  })

  it('allows a matched result without manual approval', () => {
    expect(getTaxReviewState({
      status: 'found',
      comparison: { tax_code: 'match', company_name: 'match' },
    })).toMatchObject({
      status: 'matched',
      blocksApproval: false,
      requiresManualApproval: false,
    })
  })

  it.each(['not_found', 'unavailable', 'invalid_response'])(
    'requires an explicit manual approval for %s',
    (status) => {
      expect(getTaxReviewState({ status })).toMatchObject({
        status,
        blocksApproval: false,
        requiresManualApproval: true,
      })
    },
  )

  it('treats a provider result with mismatched fields as manual review', () => {
    expect(getTaxReviewState({
      status: 'found',
      comparison: { tax_code: 'match', company_name: 'mismatch' },
    })).toMatchObject({
      status: 'mismatch',
      requiresManualApproval: true,
    })
  })
})
