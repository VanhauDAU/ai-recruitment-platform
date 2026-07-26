import { describe, expect, it } from 'vitest'
import { getEmployerVerificationProgress } from './verification-progress'

describe('employer verification progress', () => {
  it('counts the ten account-verification steps from the shared read model', () => {
    expect(getEmployerVerificationProgress({
      email_verified: true,
      registration_completed: true,
      consulting_need_completed: true,
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: true,
      business_doc_approved: false,
      candidate_dpa_approved: false,
      dpa_accepted: false,
      representative_verified: false,
      first_job_posted: false,
    })).toEqual({ completed: 6, total: 10, percent: 60 })
  })
})
