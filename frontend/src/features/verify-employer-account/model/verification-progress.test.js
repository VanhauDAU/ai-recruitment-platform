import { describe, expect, it } from 'vitest'
import { getEmployerVerificationProgress } from './verification-progress'

describe('employer verification progress', () => {
  it('counts only the five main employer-verification steps', () => {
    expect(getEmployerVerificationProgress({
      email_verified: true,
      registration_completed: true,
      consulting_need_completed: true,
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: true,
      business_doc_current: true,
      business_doc_approved: false,
      candidate_dpa_submitted: false,
      dpa_accepted: false,
      representative_verified: false,
      first_job_posted: false,
    })).toEqual({ completed: 3, total: 5, percent: 60 })
  })

  it('does not count documents of an expired or revoked case', () => {
    expect(getEmployerVerificationProgress({
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: true,
      business_doc_current: false,
      candidate_dpa_submitted: true,
      dpa_accepted: true,
    })).toEqual({ completed: 4, total: 5, percent: 80 })
  })
})
