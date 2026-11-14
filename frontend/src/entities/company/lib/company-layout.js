/**
 * Hồ sơ công ty như trang công khai sẽ hiển thị sau khi áp một bố cục: xếp lại
 * các khối cột chính theo `section_order`, bỏ khối bị ẩn (khối `always_on` của
 * registry không ẩn được), đổi màu nhấn theo bảng màu của registry và gắn tin
 * ghim vào khối việc làm. Hàm thuần: `content` là DTO với mọi khối có nội dung,
 * theo thứ tự mặc định; khoá lạ trong bố cục bị bỏ qua, khối ngoài
 * `section_order` giữ thứ tự gốc ở cuối.
 */
export function applyCompanyLayout(content, layout, registry) {
  const alwaysOn = new Set(
    (registry?.sections || []).filter((section) => section.always_on).map((section) => section.key),
  )
  const hidden = new Set((layout?.hidden_sections || []).filter((key) => !alwaysOn.has(key)))
  const order = layout?.section_order || []
  const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length)
  const accent = (registry?.accents || []).find((item) => item.key === layout?.accent)
  const pinned = layout?.pinned_job_public_ids

  return {
    ...content,
    theme: accent
      ? { ...content.theme, accent: { key: accent.key, primary: accent.primary, hover: accent.hover, soft: accent.soft } }
      : content.theme,
    sections: (content.sections || [])
      .filter((section) => !hidden.has(section.key))
      .map((section) => (section.type === 'jobs' && pinned ? { ...section, pinned_job_public_ids: pinned } : section))
      .sort((left, right) => rank(left.key) - rank(right.key)),
    sidebar: (content.sidebar || []).filter((block) => !hidden.has(block.key)),
  }
}
