export const COMPANY_FORM_FIELDS = [
  'business_type', 'tax_code', 'company_name', 'trade_name',
  'trade_name_same_as_registered', 'website_url', 'has_no_website', 'email',
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

export function companyToForm(company = {}) {
  return {
    ...DEFAULT_COMPANY_FORM,
    ...Object.fromEntries(COMPANY_FORM_FIELDS.map((field) => [field, company[field]])),
    has_no_logo: Boolean(company.has_no_logo),
    industries: (company.industries_detail || []).map((item) => item.id),
    primary_industry: company.primary_industry_id
      || (company.industries_detail || []).find((item) => item.is_primary)?.id,
    markets: company.markets || [],
    target_customers: company.target_customers || [],
  }
}

export function buildCompanyChanges(values, company) {
  const before = companyToForm(company)
  return Object.fromEntries(COMPANY_FORM_FIELDS.flatMap((field) => {
    const current = values[field] ?? (Array.isArray(before[field]) ? [] : '')
    const previous = before[field] ?? (Array.isArray(current) ? [] : '')
    return JSON.stringify(current) === JSON.stringify(previous) ? [] : [[field, current]]
  }))
}

export function validateCompanyImage(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'
  if (file.size > 5 * 1024 * 1024) return 'Mỗi ảnh phải nhỏ hơn hoặc bằng 5 MB.'
  return ''
}
