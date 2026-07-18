import { describe, expect, it } from 'vitest'
import { getEmployerVerificationProgress } from './verification-progress'

describe('employer verification progress', () => {
  it('counts only the six visible account-safety steps', () => {
    expect(getEmployerVerificationProgress({
      registration_completed: true,
      consulting_need_completed: true,
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: false,
      candidate_dpa_submitted: true,
      dpa_accepted: false,
      first_job_posted: false,
    })).toEqual({ completed: 3, total: 6, percent: 50 })
  })
})
