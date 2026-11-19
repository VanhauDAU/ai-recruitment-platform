// Nhãn tiếng Việt cho các enum của hồ sơ nhà tuyển dụng và công ty.
// Giữ khớp với TextChoices ở `backend/apps/employers/models/company.py`
// và `membership.py`; cập nhật hai nơi cùng lúc khi thêm giá trị mới.
import { m } from '@/shared/config/i18n'

export const COMPANY_VALUE_LABELS = {
  business_type: {
    enterprise: m.employer_profile_business_enterprise(),
    household: m.employer_profile_business_household(),
  },
  company_size: {
    '1-9': m.employer_profile_company_size({ range: '1 - 9' }),
    '10-24': m.employer_profile_company_size({ range: '10 - 24' }),
    '25-99': m.employer_profile_company_size({ range: '25 - 99' }),
    '100-499': m.employer_profile_company_size({ range: '100 - 499' }),
    '500-1000': m.employer_profile_company_size({ range: '500 - 1000' }),
    '1000+': m.employer_profile_company_size({ range: '1000+' }),
    '3000+': m.employer_profile_company_size({ range: '3000+' }),
    '5000+': m.employer_profile_company_size({ range: '5000+' }),
    '10000+': m.employer_profile_company_size({ range: '10000+' }),
  },
  markets: {
    domestic: m.employer_profile_market_domestic(),
    asia: m.employer_profile_market_asia(),
    europe: m.employer_profile_market_europe(),
    africa: m.employer_profile_market_africa(),
    america: m.employer_profile_market_america(),
    australia: m.employer_profile_market_australia(),
  },
  target_customers: { b2b: 'B2B', b2c: 'B2C', b2g: 'B2G' },
  company_role: {
    owner: m.employer_profile_role_owner(),
    member: m.employer_profile_role_member(),
  },
  gender: {
    male: m.employer_profile_gender_male(),
    female: m.employer_profile_gender_female(),
    other: m.employer_profile_gender_other(),
  },
}

/** Nhãn hiển thị của một giá trị enum; trả lại nguyên giá trị nếu chưa có nhãn. */
export function companyValueLabel(field, value) {
  return COMPANY_VALUE_LABELS[field]?.[value] ?? value
}

/** Các trường công ty lưu HTML từ rich-text editor, phải sanitize trước khi render. */
export const COMPANY_HTML_FIELDS = new Set(['description', 'employee_benefits'])
