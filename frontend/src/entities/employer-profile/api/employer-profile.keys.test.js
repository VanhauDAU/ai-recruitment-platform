import { describe, expect, it } from 'vitest'
import { employerProfileKeys } from './employer-profile.keys'

describe('employer profile query keys', () => {
  it('keeps company documents inside the company namespace', () => {
    expect(employerProfileKeys.company).toEqual(['employer', 'company'])
    expect(employerProfileKeys.companyDocuments).toEqual([
      ...employerProfileKeys.company,
      'documents',
    ])
  })
})
