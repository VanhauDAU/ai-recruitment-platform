import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptEmployerDpa,
  checkEmployerPhoneAvailability,
  changeEmployerCompanyUpdateRequestLifecycle,
  completeEmployerRegistration,
  createEmployerCompany,
  getEmployerCompanyDocumentContent,
  getEmployerCompanyDocuments,
  getEmployerCompanyUpdateRequests,
  getEmployerIndustries,
  getEmployerProfile,
  getEmployerRecruitmentNeed,
  joinEmployerCompany,
  searchEmployerCompanies,
  sendEmployerPhoneOtp,
  saveEmployerRecruitmentNeed,
  saveEmployerCompanyTradeNameWebsite,
  previewEmployerDataProcessingAgreement,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
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

    get.mockResolvedValue({ data: { available: true } })

    await completeEmployerRegistration(profile)
    await checkEmployerPhoneAvailability('0912345678')
    await sendEmployerPhoneOtp('0912345678', 'Password@123')
    await verifyEmployerPhoneOtp('123456')
    await acceptEmployerDpa()

    expect(post).toHaveBeenCalledWith('/employer/onboarding/registration/', profile)
    expect(get).toHaveBeenCalledWith('/employer/phone/check/', { params: { phone: '0912345678' } })
    expect(post).toHaveBeenCalledWith('/employer/phone/send-otp/', { phone: '0912345678', password: 'Password@123' })
    expect(post).toHaveBeenCalledWith('/employer/phone/verify/', { code: '123456' })
    expect(post).toHaveBeenCalledWith('/employer/dpa/accept/')
  })

  it('attaches a scanned business registration session as multipart data', async () => {
    post.mockResolvedValue({ data: { id: 1, status: 'pending' } })
    const file = new File(['registration'], 'business.pdf', { type: 'application/pdf' })

    await expect(uploadEmployerBusinessDocument(file, {
      uploadSession: { public_id: 'ups_business' },
    })).resolves.toMatchObject({ status: 'pending' })

    expect(post).toHaveBeenCalledTimes(1)
    const [url, formData] = post.mock.calls[0]
    expect(url).toBe('/employer/company/documents/')
    expect(formData.get('doc_type')).toBe('business_registration')
    expect(formData.get('verification_method')).toBe('business_registration')
    expect(formData.get('upload_session')).toBe('ups_business')
    expect(formData.get('file')).toBeNull()
  })

  it('marks additional identity images as part of the current document set', async () => {
    post.mockResolvedValue({ data: { id: 2, status: 'pending' } })
    const file = new File(['back'], 'cccd-mat-sau.png', { type: 'image/png' })

    await uploadEmployerCompanyDocument('identity_document', file, {
      append: true,
      uploadSession: { public_id: 'ups_identity' },
    })

    const [url, formData] = post.mock.calls[0]
    expect(url).toBe('/employer/company/documents/')
    expect(formData.get('doc_type')).toBe('identity_document')
    expect(formData.get('append')).toBe('true')
    expect(formData.get('upload_session')).toBe('ups_identity')
  })

  it('targets one current document when uploading a replacement', async () => {
    post.mockResolvedValue({ data: { id: 3, status: 'pending' } })
    const file = new File(['clear'], 'cccd-mat-sau-moi.png', { type: 'image/png' })

    await uploadEmployerCompanyDocument('identity_document', file, {
      replaceDocument: 'doc_rejected',
      uploadSession: { public_id: 'ups_replacement' },
    })

    const [, formData] = post.mock.calls[0]
    expect(formData.get('doc_type')).toBe('identity_document')
    expect(formData.get('replaces')).toBe('doc_rejected')
    expect(formData.get('append')).toBeNull()
  })

  it('requests a temporary PDF preview for a selected Word agreement', async () => {
    const preview = new Blob(['preview'], { type: 'application/pdf' })
    post.mockResolvedValue({ data: preview })
    const file = new File(['agreement'], 'thoa-thuan.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    await expect(previewEmployerDataProcessingAgreement(file)).resolves.toBe(preview)

    const [url, formData, options] = post.mock.calls[0]
    expect(url).toBe('/employer/company/documents/preview/')
    expect(formData.get('file')).toBe(file)
    expect(options).toEqual({ responseType: 'blob' })
  })

  it('saves a trade-name proof website as multipart data', async () => {
    post.mockResolvedValue({ data: { id: 9, source_type: 'website' } })

    await expect(saveEmployerCompanyTradeNameWebsite(
      'https://example.com/thuong-hieu',
      {
        updateRequest: 'cur_trade_name',
        replaceDocument: 'doc_trade_name_old',
      },
    )).resolves.toMatchObject({ source_type: 'website' })

    const [url, formData] = post.mock.calls[0]
    expect(url).toBe('/employer/company/documents/')
    expect(formData.get('doc_type')).toBe('trade_name_proof')
    expect(formData.get('source_type')).toBe('website')
    expect(formData.get('website_url')).toBe('https://example.com/thuong-hieu')
    expect(formData.get('update_request')).toBe('cur_trade_name')
    expect(formData.get('replaces')).toBe('doc_trade_name_old')
    expect(formData.get('file')).toBeNull()
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
    await uploadEmployerDataProcessingAgreement(file, {
      uploadSession: { public_id: 'ups_dpa' },
    })

    expect(get).toHaveBeenNthCalledWith(2, '/employer/company/search/', { params: { q: 'Acme' } })
    expect(post).toHaveBeenCalledWith('/employer/company/create/', { company_name: 'Acme' })
    expect(post).toHaveBeenCalledWith('/employer/company/join/', expect.any(FormData))
    const dpaBody = post.mock.calls.at(-1)[1]
    expect(dpaBody.get('doc_type')).toBe('data_processing_agreement')
  })

  it('loads private company-document content through the authenticated client', async () => {
    const content = new Blob(['document'], { type: 'application/pdf' })
    get.mockResolvedValue({ data: content })

    await expect(getEmployerCompanyDocumentContent({ file_url: '/employer/company/documents/12/content/' })).resolves.toBe(content)

    expect(get).toHaveBeenCalledWith('/employer/company/documents/12/content/', { responseType: 'blob' })
  })

  it('loads the current recruiter document scope explicitly', async () => {
    get.mockResolvedValue({ data: [{ public_id: 'doc_mine' }] })

    await expect(getEmployerCompanyDocuments({ scope: 'mine' })).resolves.toEqual([
      { public_id: 'doc_mine' },
    ])

    expect(get).toHaveBeenCalledWith('/employer/company/documents/', {
      params: { scope: 'mine' },
    })
  })

  it('loads actor and company update-request scopes explicitly', async () => {
    get
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'cur_mine' }] } })
      .mockResolvedValueOnce({ data: [{ public_id: 'cur_company' }] })

    await expect(getEmployerCompanyUpdateRequests({ scope: 'mine' })).resolves.toEqual([
      { public_id: 'cur_mine' },
    ])
    await expect(getEmployerCompanyUpdateRequests({ scope: 'company' })).resolves.toEqual([
      { public_id: 'cur_company' },
    ])

    expect(get).toHaveBeenNthCalledWith(1, '/employer/company/update-requests/', {
      params: { scope: 'mine' },
    })
    expect(get).toHaveBeenNthCalledWith(2, '/employer/company/update-requests/', {
      params: { scope: 'company' },
    })
  })

  it('keeps the unscoped update-request request compatible', async () => {
    get.mockResolvedValue({ data: [] })

    await expect(getEmployerCompanyUpdateRequests()).resolves.toEqual([])

    expect(get).toHaveBeenCalledWith('/employer/company/update-requests/')
  })

  it('uses the explicit lifecycle endpoint to withdraw an update request', async () => {
    post.mockResolvedValue({ data: { public_id: 'cur_1', status: 'withdrawn' } })

    await expect(changeEmployerCompanyUpdateRequestLifecycle(
      'cur_1',
      'withdraw',
      { lock_version: 4 },
    )).resolves.toMatchObject({ status: 'withdrawn' })

    expect(post).toHaveBeenCalledWith(
      '/employer/company/update-requests/cur_1/withdraw/',
      { lock_version: 4 },
    )
  })
})
