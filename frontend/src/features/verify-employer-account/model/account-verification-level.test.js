import { describe, expect, it } from 'vitest'
import { getEmployerAccountVerificationLevel } from './account-verification-level'

describe('employer account verification level', () => {
  it('stays at level 0 until email verification is complete', () => {
    expect(getEmployerAccountVerificationLevel({
      phone_verified: true,
      company_linked: true,
      business_doc_approved: true,
      email_verified: false,
    })).toEqual({ level: 0, total: 3, percent: 0 })
  })

  it('assigns level 1 to every verified email account', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: false,
      business_doc_approved: false,
    })).toEqual({ level: 1, total: 3, percent: 33 })
  })

  it('assigns level 2 only after phone and business document approval', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: true,
      business_doc_approved: true,
      email_domain_verified: false,
    })).toEqual({ level: 2, total: 3, percent: 67 })
  })

  it('assigns level 3 for a company email with no report history', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: true,
      business_doc_approved: true,
      email_domain_verified: true,
      no_report_history: true,
    })).toEqual({ level: 3, total: 3, percent: 100 })
  })

  it('falls back to the account email when the API omits its domain flag', () => {
    expect(getEmployerAccountVerificationLevel({
      email_verified: true,
      phone_verified: true,
      business_doc_approved: true,
    }, { email: 'owner@acme.vn' })).toEqual({ level: 3, total: 3, percent: 100 })
  })

  it('uses the session email verification flag when onboarding data is stale', () => {
    expect(getEmployerAccountVerificationLevel({}, { email_verified: true })).toEqual({
      level: 1,
      total: 3,
      percent: 33,
    })
  })
})
