// Nhãn tiếng Việt cho các enum của hồ sơ nhà tuyển dụng và công ty.
// Giữ khớp với TextChoices ở `backend/apps/employers/models/company.py`
// và `membership.py`; cập nhật hai nơi cùng lúc khi thêm giá trị mới.
export const COMPANY_VALUE_LABELS = {
  business_type: {
    enterprise: 'Doanh nghiệp',
    household: 'Hộ kinh doanh',
  },
  company_size: {
    '1-9': '1 - 9 nhân viên',
    '10-24': '10 - 24 nhân viên',
    '25-99': '25 - 99 nhân viên',
    '100-499': '100 - 499 nhân viên',
    '500-1000': '500 - 1000 nhân viên',
    '1000+': '1000+ nhân viên',
    '3000+': '3000+ nhân viên',
    '5000+': '5000+ nhân viên',
    '10000+': '10000+ nhân viên',
  },
  markets: {
    domestic: 'Nội địa',
    asia: 'Châu Á',
    europe: 'Châu Âu',
    africa: 'Châu Phi',
    america: 'Châu Mỹ',
    australia: 'Châu Úc',
  },
  target_customers: { b2b: 'B2B', b2c: 'B2C', b2g: 'B2G' },
  company_role: {
    owner: 'Người tạo công ty',
    member: 'Thành viên',
  },
  gender: { male: 'Nam', female: 'Nữ', other: 'Khác' },
}

/** Nhãn hiển thị của một giá trị enum; trả lại nguyên giá trị nếu chưa có nhãn. */
export function companyValueLabel(field, value) {
  return COMPANY_VALUE_LABELS[field]?.[value] ?? value
}

/** Các trường công ty lưu HTML từ rich-text editor, phải sanitize trước khi render. */
export const COMPANY_HTML_FIELDS = new Set(['description', 'employee_benefits'])
