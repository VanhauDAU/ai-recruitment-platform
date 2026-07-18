import { describe, expect, it } from 'vitest'
import { getEmployerAccountVerificationLevel } from './account-verification-level'

describe('employer account verification level', () => {
  it('uses only the three sidebar verification milestones', () => {
    expect(getEmployerAccountVerificationLevel({
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: false,
      candidate_dpa_submitted: true,
      dpa_accepted: true,
      first_job_posted: true,
    })).toEqual({ level: 2, total: 3, percent: 67 })
  })

  it('reports the maximum level after all three milestones are complete', () => {
    expect(getEmployerAccountVerificationLevel({
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: true,
    })).toEqual({ level: 3, total: 3, percent: 100 })
  })
})
