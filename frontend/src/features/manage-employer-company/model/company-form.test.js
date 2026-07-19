import { describe, expect, it } from 'vitest'
import { buildCompanyChanges, companyToForm, validateCompanyImage } from './company-form'

const company = {
  business_type: 'enterprise',
  tax_code: '0101234567',
  company_name: 'Acme',
  trade_name: 'Acme',
  trade_name_same_as_registered: true,
  website_url: 'https://acme.vn',
  has_no_website: false,
  email: 'hr@acme.vn',
  phone: '0912345678',
  address: 'Hà Nội',
  company_size: '25-99',
  description: '<p>Giới thiệu</p>',
  employee_benefits: '',
  markets: ['domestic'],
  target_customers: ['b2b'],
  industries_detail: [{ id: 2, is_primary: true }, { id: 3, is_primary: false }],
}

describe('company form model', () => {
  it('maps API detail to editable values and keeps the primary industry', () => {
    expect(companyToForm(company)).toMatchObject({
      industries: [2, 3],
      primary_industry: 2,
      markets: ['domestic'],
    })
  })

  it('creates a minimal update-request diff', () => {
    const values = { ...companyToForm(company), address: 'TP.HCM' }
    expect(buildCompanyChanges(values, company)).toEqual({ address: 'TP.HCM' })
  })

  it('validates image type and the 5 MB boundary before upload', () => {
    expect(validateCompanyImage(new File(['ok'], 'office.webp', { type: 'image/webp' }))).toBe('')
    expect(validateCompanyImage(new File(['bad'], 'office.gif', { type: 'image/gif' }))).toMatch(/JPG/)
    expect(validateCompanyImage({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/)
  })
})
