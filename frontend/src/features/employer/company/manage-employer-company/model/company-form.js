import { m } from '@/shared/config/i18n'

export const COMPANY_FORM_FIELDS = [
  'business_type', 'tax_code', 'company_name', 'trade_name',
  'trade_name_same_as_registered', 'has_no_logo', 'website_url', 'has_no_website', 'email',
  'phone', 'address', 'company_size', 'description', 'employee_benefits',
  'markets', 'target_customers', 'founded_year', 'industries', 'primary_industry',
]

export const DEFAULT_COMPANY_FORM = {
  business_type: 'enterprise',
  has_no_website: false,
  has_no_logo: false,
  trade_name_same_as_registered: true,
  markets: [],
  target_customers: [],
  description: '',
  employee_benefits: '',
}

export const COMPANY_DESCRIPTION_MIN_LENGTH = 500

export function companyTaxCodeValidationError(value) {
  const taxCode = String(value ?? '')
  if (!taxCode.trim()) return m.employer_company_tax_code_required()
  if (!/^\d+$/.test(taxCode)) return m.employer_company_tax_code_digits()
  if (![10, 13].includes(taxCode.length)) return m.employer_company_tax_code_length()
  return ''
}

export function companyDescriptionTextLength(value) {
  const html = String(value ?? '')
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length
  }
  const document = new DOMParser().parseFromString(html, 'text/html')
  return (document.body.textContent || '').replace(/\s+/g, ' ').trim().length
}

export function companyDescriptionValidationError(value) {
  const length = companyDescriptionTextLength(value)
  if (!length) return m.employer_company_description_required()
  if (length < COMPANY_DESCRIPTION_MIN_LENGTH) {
    return m.employer_company_description_min_length({ min: COMPANY_DESCRIPTION_MIN_LENGTH, length })
  }
  return ''
}

export function companyToForm(company = {}, pendingChanges = {}) {
  const base = {
    ...DEFAULT_COMPANY_FORM,
    ...Object.fromEntries(COMPANY_FORM_FIELDS.map((field) => [field, company[field]])),
    has_no_logo: Boolean(company.has_no_logo),
    industries: (company.industries_detail || []).map((item) => item.id),
    primary_industry: company.primary_industry_id
      || (company.industries_detail || []).find((item) => item.is_primary)?.id,
    markets: company.markets || [],
    target_customers: company.target_customers || [],
  }
  return {
    ...base,
    ...Object.fromEntries(
      COMPANY_FORM_FIELDS
        .filter((field) => Object.hasOwn(pendingChanges, field))
        .map((field) => [field, pendingChanges[field]]),
    ),
  }
}

export function buildCompanyChanges(values, company, { pendingChanges = {} } = {}) {
  const before = companyToForm(company)
  const keepsExistingTradeName = (
    values.trade_name_same_as_registered === true
    && before.trade_name_same_as_registered === true
    && values.company_name === before.company_name
    && !Object.hasOwn(pendingChanges, 'trade_name')
  )
  return Object.fromEntries(COMPANY_FORM_FIELDS.flatMap((field) => {
    // Dữ liệu legacy có thể đánh dấu tên thương mại trùng tên pháp lý nhưng hai
    // chuỗi đang lệch nhau. Không biến việc gửi một trường khác thành yêu cầu
    // sửa tên thương mại ngoài ý muốn của người dùng.
    if (field === 'trade_name' && keepsExistingTradeName) return []
    const current = values[field] ?? (Array.isArray(before[field]) ? [] : '')
    const previous = before[field] ?? (Array.isArray(current) ? [] : '')
    return JSON.stringify(current) === JSON.stringify(previous) ? [] : [[field, current]]
  }))
}

export function hasCompanyFormValueChanges(values = {}, initialValues = {}) {
  return COMPANY_FORM_FIELDS.some((field) => {
    const initial = initialValues[field]
    const current = values[field] ?? (Array.isArray(initial) ? [] : '')
    const previous = initial ?? (Array.isArray(current) ? [] : '')
    return JSON.stringify(current) !== JSON.stringify(previous)
  })
}

export function validateCompanyImage(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return m.employer_company_image_type()
  if (file.size > 5 * 1024 * 1024) return m.employer_company_image_size()
  return ''
}
