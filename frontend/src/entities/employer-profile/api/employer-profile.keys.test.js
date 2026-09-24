import { describe, expect, it } from 'vitest'
import { employerProfileKeys } from './employer-profile.keys'

describe('employer profile query keys', () => {
  it('keeps actor-bound phone challenge status under the employer root', () => {
    expect(employerProfileKeys.phoneChallenge('poc_test')).toEqual([
      ...employerProfileKeys.phoneChallenges,
      'poc_test',
    ])
  })

  it('keeps company documents inside the company namespace', () => {
    expect(employerProfileKeys.company).toEqual(['employer', 'company'])
    expect(employerProfileKeys.companyDocuments).toEqual([
      ...employerProfileKeys.company,
      'documents',
    ])
    expect(employerProfileKeys.companyDocumentList('mine')).toEqual([
      ...employerProfileKeys.companyDocuments,
      { scope: 'mine' },
    ])
  })

  it('isolates personal and company update-request caches under one root', () => {
    expect(employerProfileKeys.companyUpdateRequests).toEqual([
      ...employerProfileKeys.company,
      'update-requests',
    ])
    expect(employerProfileKeys.companyUpdateRequestList('mine')).toEqual([
      ...employerProfileKeys.companyUpdateRequests,
      { scope: 'mine' },
    ])
    expect(employerProfileKeys.companyUpdateRequestList('company')).toEqual([
      ...employerProfileKeys.companyUpdateRequests,
      { scope: 'company' },
    ])
    expect(employerProfileKeys.companyUpdateRequestList('mine')).not.toEqual(
      employerProfileKeys.companyUpdateRequestList('company'),
    )
  })
})
