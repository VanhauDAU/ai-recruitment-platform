import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptEmployerDpa,
  completeEmployerRegistration,
  getEmployerProfile,
  getEmployerRecruitmentNeed,
  sendEmployerPhoneOtp,
  saveEmployerRecruitmentNeed,
  verifyEmployerPhoneOtp,
} from './employer-profile.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('employer profile API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('loads the current recruiter onboarding state', async () => {
    get.mockResolvedValue({ data: { onboarding: { account_ready: false } } })

    await expect(getEmployerProfile()).resolves.toEqual({ onboarding: { account_ready: false } })
    expect(get).toHaveBeenCalledWith('/employer/me/')
  })

  it('loads and saves the post-verification recruitment need', async () => {
    get.mockResolvedValue({ data: null })
    post.mockResolvedValue({ data: { public_id: 'need_1' } })
    const payload = { position_category: 1, position_level: 'employee', headcount: 2 }

    await expect(getEmployerRecruitmentNeed()).resolves.toBeNull()
    await expect(saveEmployerRecruitmentNeed(payload)).resolves.toEqual({ public_id: 'need_1' })

    expect(get).toHaveBeenCalledWith('/employer/consulting-need/')
    expect(post).toHaveBeenCalledWith('/employer/consulting-need/', payload)
  })

  it('keeps registration, phone and DPA endpoint contracts', async () => {
    post.mockResolvedValue({ data: { ok: true } })
    const profile = {
      full_name: 'Nguyễn An', gender: 'female', contact_phone: '0912345678',
      company_name: 'Acme', work_location: 1, terms_accepted: true, marketing_opt_in: false,
    }

    await completeEmployerRegistration(profile)
    await sendEmployerPhoneOtp('0912345678')
    await verifyEmployerPhoneOtp('123456')
    await acceptEmployerDpa()

    expect(post).toHaveBeenCalledWith('/employer/onboarding/registration/', profile)
    expect(post).toHaveBeenCalledWith('/employer/phone/send-otp/', { phone: '0912345678' })
    expect(post).toHaveBeenCalledWith('/employer/phone/verify/', { code: '123456' })
    expect(post).toHaveBeenCalledWith('/employer/dpa/accept/')
  })
})
