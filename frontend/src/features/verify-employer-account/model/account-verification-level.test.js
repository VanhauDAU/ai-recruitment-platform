import { describe, expect, it } from 'vitest'
import { getEmployerAccountVerificationLevel } from './account-verification-level'

describe('employer account verification level', () => {
  it('stays at level 0 until email verification is complete', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: false,
      phone_verified: true,
      business_doc_submitted: true,
      business_doc_approved: true,
      no_report_history: true,
    })).toEqual({ level: 0, total: 3, percent: 0 })
  })

  it('keeps a verified-email account at level 1 while business documents await approval', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: true,
      company_linked: true,
      business_doc_submitted: true,
      business_doc_approved: false,
      no_report_history: true,
    })).toEqual({ level: 1, total: 3, percent: 33 })
  })

  it('does not advance beyond level 1 without phone verification', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: false,
      business_doc_approved: true,
      no_report_history: true,
    })).toEqual({ level: 1, total: 3, percent: 33 })
  })

  it('assigns level 2 after phone and business-document verification', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: true,
      business_doc_approved: true,
      no_report_history: false,
    })).toEqual({ level: 2, total: 3, percent: 67 })
  })

  it('assigns level 3 after approval when there is no job-report history', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: true,
      business_doc_approved: true,
      no_report_history: true,
    })).toEqual({ level: 3, total: 3, percent: 100 })
  })
})
