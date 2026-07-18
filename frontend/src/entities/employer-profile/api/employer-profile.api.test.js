import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptEmployerDpa,
  completeEmployerRegistration,
  createEmployerCompany,
  getEmployerCompanyDocuments,
  getEmployerIndustries,
  getEmployerProfile,
  getEmployerRecruitmentNeed,
  joinEmployerCompany,
  searchEmployerCompanies,
  sendEmployerPhoneOtp,
  saveEmployerRecruitmentNeed,
  uploadEmployerBusinessDocument,
  uploadEmployerDataProcessingAgreement,
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
      work_location: 1, terms_accepted: true, marketing_opt_in: false,
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

  it('uploads a business registration document as multipart data', async () => {
    post.mockResolvedValue({ data: { id: 1, status: 'pending' } })
    const file = new File(['registration'], 'business.pdf', { type: 'application/pdf' })

    await expect(uploadEmployerBusinessDocument(file)).resolves.toMatchObject({ status: 'pending' })

    expect(post).toHaveBeenCalledTimes(1)
    const [url, formData] = post.mock.calls[0]
    expect(url).toBe('/employer/company/documents/')
    expect(formData.get('doc_type')).toBe('business_registration')
    expect(formData.get('file')).toBe(file)
  })

  it('supports explicit company selection, creation and DPA documents', async () => {
    const file = new File(['proof'], 'proof.pdf', { type: 'application/pdf' })
    get
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Công nghệ' }] })
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'co-1' }] } })
      .mockResolvedValueOnce({ data: [{ id: 2, doc_type: 'business_registration' }] })
    post.mockResolvedValue({ data: { ok: true } })

    await expect(getEmployerIndustries()).resolves.toHaveLength(1)
    await expect(searchEmployerCompanies('Acme')).resolves.toEqual([{ public_id: 'co-1' }])
    await expect(getEmployerCompanyDocuments()).resolves.toHaveLength(1)
    await createEmployerCompany({ company_name: 'Acme' })
    await joinEmployerCompany({
      company: 'co-1',
      proof_type: 'business_registration',
      business_registration_file: file,
    })
    await uploadEmployerDataProcessingAgreement(file)

    expect(get).toHaveBeenNthCalledWith(2, '/employer/company/search/', { params: { q: 'Acme' } })
    expect(post).toHaveBeenCalledWith('/employer/company/create/', { company_name: 'Acme' })
    expect(post).toHaveBeenCalledWith('/employer/company/join/', expect.any(FormData))
    const dpaBody = post.mock.calls.at(-1)[1]
    expect(dpaBody.get('doc_type')).toBe('data_processing_agreement')
  })
})
