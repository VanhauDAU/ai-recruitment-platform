import { CV_EXPERIENCE_BANDS } from '@/entities/cv-template'

// Từ vựng của trang "Nội dung theo vị trí" (khớp backend CVT-1b/CVT-3), viết bằng
// lời thường để admin không cần biết thuật ngữ nội bộ.
export const LOCALES = [{ value: 'vi-VN', label: 'Tiếng Việt' }, { value: 'en-US', label: 'Tiếng Anh' }]

// Bốn mức kinh nghiệm ứng viên chọn khi tạo CV (định nghĩa dùng chung với trang ứng viên).
export const BANDS = CV_EXPERIENCE_BANDS
export const TOTAL_VARIANTS = LOCALES.length * BANDS.length
export const bandLabel = (band) => BANDS.find((item) => item.value === band)?.label || band
export const localeLabel = (locale) => LOCALES.find((item) => item.value === locale)?.label || locale

// Mục mặc định của CV dựng sẵn khi vị trí chưa chỉnh "Các mục trong CV".
export const DEFAULT_SECTION_KEYS = ['summary', 'experience', 'education', 'skills']

// Đếm số bản nội dung riêng của một vị trí từ ma trận độ phủ của backend.
export function coverageSummary(coverage) {
  const states = Object.values(coverage || {}).flatMap((bands) => Object.values(bands))
  return { own: states.filter((state) => state === 'published').length, pending: states.filter((state) => state === 'pending').length }
}

export const FIELD_TYPES = [
  { value: 'text', label: 'Văn bản ngắn' },
  { value: 'long_text', label: 'Đoạn văn' },
  { value: 'url', label: 'Liên kết' },
  { value: 'number', label: 'Số' },
  { value: 'date', label: 'Tháng/năm' },
  { value: 'select', label: 'Chọn một' },
  { value: 'multi_select', label: 'Chọn nhiều' },
  { value: 'tags', label: 'Thẻ (gõ tự do)' },
]

// Document hiển thị được từ nội dung gợi ý (một cột), để xem trước mà không cần mẫu.
export function sampleDocument(content, themeColor = '#00A66A') {
  return {
    schema_version: 1,
    content_json: content,
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', row: 0, width_percent: 100, section_instance_ids: content.sections.map((section) => section.instance_id) }] },
    style_json: { schema_version: 1, theme_color: themeColor, font_family: 'Inter', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
}
