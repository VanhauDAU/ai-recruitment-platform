// Nhãn và cách hiển thị các trường của yêu cầu cập nhật công ty trong màn đối chiếu.
export const FIELD_LABELS = {
  business_type: 'Loại hình',
  tax_code: 'Mã số thuế',
  company_name: 'Tên đăng ký',
  trade_name: 'Tên thương mại',
  trade_name_same_as_registered: 'Tên thương mại trùng tên đăng ký',
  website_url: 'Website',
  has_no_website: 'Không có website',
  email: 'Email',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  company_size: 'Quy mô',
  description: 'Mô tả',
  employee_benefits: 'Phúc lợi',
  markets: 'Thị trường',
  target_customers: 'Khách hàng mục tiêu',
  industries: 'Lĩnh vực',
  primary_industry: 'Lĩnh vực chính',
  founded_year: 'Năm thành lập',
  logo_url: 'Logo công ty',
  logo_pending: 'Logo công ty',
  cover_image_url: 'Ảnh bìa công ty',
  cover_pending: 'Ảnh bìa công ty',
  gallery_additions: 'Ảnh thư viện thêm mới',
  gallery_deletions: 'Ảnh thư viện xóa',
  gallery_pending: 'Ảnh thư viện',
  headline: 'Khẩu hiệu',
  culture: 'Văn hoá công ty',
  video_url: 'Video giới thiệu',
  social_links: 'Mạng xã hội',
  benefits: 'Phúc lợi dạng thẻ',
  offices: 'Văn phòng',
}

export const SOCIAL_LABELS = { facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' }
// Danh sách chỉ có mã (benefit_id, province_id) trong `changes`; bản dễ đọc nằm ở
// `previews` (đề xuất) và `current_values` (hiện tại).
export const PREVIEW_LIST_FIELDS = new Set(['benefits', 'offices'])

export const VALUE_LABELS = {
  business_type: { enterprise: 'Doanh nghiệp', household: 'Hộ kinh doanh' },
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
    domestic: 'Nội địa', asia: 'Châu Á', europe: 'Châu Âu', africa: 'Châu Phi',
    america: 'Châu Mỹ', australia: 'Châu Úc',
  },
  target_customers: { b2b: 'B2B', b2c: 'B2C', b2g: 'B2G' },
}

export const HTML_FIELDS = new Set(['description', 'employee_benefits', 'culture'])
export const MEDIA_FIELDS = new Set(['logo_url', 'cover_image_url'])
export const PENDING_MEDIA_FIELDS = new Set(['logo_pending', 'cover_pending', 'gallery_pending'])
