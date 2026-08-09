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

export function validateCompanyImage(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'
  if (file.size > 5 * 1024 * 1024) return 'Mỗi ảnh phải nhỏ hơn hoặc bằng 5 MB.'
  return ''
}
