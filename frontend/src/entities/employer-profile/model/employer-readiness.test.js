import { describe, expect, it } from 'vitest'
import {
  EMPLOYER_CAPABILITIES,
  employerReadinessAction,
  resolveEmployerReadiness,
  resolveEmployerSessionWorkspaceReady,
} from './employer-readiness'

function canonical(overrides = {}) {
  return {
    job_workspace_ready: true,
    verification_approved: true,
    candidate_data_access: true,
    dpa_status: 'current',
    blockers: [],
    onboarding: { verification_completed: false },
    ...overrides,
  }
}

describe('employer readiness contract', () => {
  it('uses a complete canonical contract even when legacy fields disagree', () => {
    const readiness = resolveEmployerReadiness(canonical())

    expect(readiness).toMatchObject({
      source: 'canonical',
      contractValid: true,
      jobWorkspaceReady: true,
      verificationApproved: true,
      candidateDataAccess: true,
      dpaStatus: 'current',
    })
  })

  it.each([
    { job_workspace_ready: true },
    canonical({ blockers: 'invalid' }),
    canonical({ dpa_status: 'future_status' }),
    canonical({ candidate_data_access: false }),
    canonical({ candidate_data_access: true, verification_approved: false }),
  ])('fails a partial or malformed canonical contract closed', (profile) => {
    const readiness = resolveEmployerReadiness({
      onboarding: { verification_completed: true },
      ...profile,
    })

    expect(readiness).toMatchObject({
      source: 'invalid',
      contractValid: false,
      jobWorkspaceReady: false,
      verificationApproved: false,
      candidateDataAccess: false,
      dpaStatus: 'unknown',
    })
    expect(readiness.blockers[0].capabilities).toContain(
      EMPLOYER_CAPABILITIES.JOB_WORKSPACE,
    )
  })

  it.each([
    'job_workspace',
    'verification',
    'candidate_data',
  ])('rejects a true %s capability when a blocker still targets it', (capability) => {
    const readiness = resolveEmployerReadiness(canonical({
      blockers: [{
        code: 'inconsistent_blocker',
        capabilities: [capability],
        message: 'Payload không nhất quán.',
        action: 'contact_support',
      }],
    }))

    expect(readiness).toMatchObject({
      source: 'invalid',
      jobWorkspaceReady: false,
      verificationApproved: false,
      candidateDataAccess: false,
    })
  })

  it('falls back to legacy workspace only when every canonical field is absent', () => {
    expect(resolveEmployerReadiness({
      onboarding: { verification_completed: true },
    })).toMatchObject({
      source: 'legacy',
      jobWorkspaceReady: true,
      verificationApproved: false,
      candidateDataAccess: false,
    })

    expect(resolveEmployerReadiness({
      onboarding: { verification_completed: false },
    }).jobWorkspaceReady).toBe(false)
  })

  it('maps machine actions without accepting a backend URL', () => {
    expect(employerReadinessAction('verify_phone')).toEqual({
      label: 'Xác thực số điện thoại',
      to: '/tuyendung/app/account/phone-verify',
    })
    expect(employerReadinessAction('https://evil.example')).toEqual({
      label: 'Liên hệ hỗ trợ',
      to: '/tuyendung/lien-he',
    })
  })

  it('prefers the session workspace field and only falls back when it is absent', () => {
    expect(resolveEmployerSessionWorkspaceReady({
      employer_job_workspace_ready: false,
      employer_verification_completed: true,
    })).toBe(false)
    expect(resolveEmployerSessionWorkspaceReady({
      employer_job_workspace_ready: true,
      employer_verification_completed: false,
    })).toBe(true)
    expect(resolveEmployerSessionWorkspaceReady({
      employer_verification_completed: true,
    })).toBe(true)
    expect(resolveEmployerSessionWorkspaceReady({
      employer_job_workspace_ready: 'yes',
      employer_verification_completed: true,
    })).toBe(false)
  })
})
