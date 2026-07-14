import { richText } from '@/entities/cv'

const SAMPLE_PERSONAL_INFO = {
  full_name: 'Nguyễn Minh Anh',
  headline: 'Business Development Executive',
  email: 'minhanh.nguyen@email.vn',
  phone: '0123 456 789',
  address: 'Quận Hoàng Mai, Hà Nội',
}

const SAMPLE_ITEMS = {
  summary: [{
    value: 'Với hơn 4 năm kinh nghiệm ở vị trí phát triển kinh doanh tại các doanh nghiệp trong và ngoài nước, tôi có khả năng xây dựng, phát triển chiến lược kinh doanh và mở rộng mạng lưới khách hàng tiềm năng. Mục tiêu trong 2 năm tới là trở thành Trưởng nhóm Phát triển kinh doanh, dẫn dắt đội ngũ hoàn thành các mục tiêu chiến lược của công ty.',
  }],
  experience: [
    {
      role: 'Business Development Executive',
      company: 'Công ty TNHH ABC',
      start_date: '2022-03',
      end_date: '2025-02',
      description: richText('Thu thập, phân tích thông tin thị trường và phát triển chiến lược kinh doanh, đóng góp vào việc tăng trưởng 10% thị phần sau 2 năm.\nMở rộng cơ sở dữ liệu khách hàng và phát triển mạng lưới khách hàng doanh nghiệp, góp phần tăng 15% doanh thu của công ty trong năm 2024.\nQuản lý pipeline bán hàng, cải thiện hiệu suất làm việc nhóm bằng cách ứng dụng phần mềm CRM.'),
    },
    {
      role: 'Nhân viên kinh doanh',
      company: 'Công ty Cổ phần XYZ',
      start_date: '2020-06',
      end_date: '2022-02',
      description: richText('Tìm kiếm, tiếp cận 80 khách hàng tiềm năng mỗi tháng qua việc gọi điện và gửi email giới thiệu sản phẩm.\nĐàm phán, thương lượng và ký kết hơn 20 hợp đồng trị giá cao trong năm 2021.'),
    },
  ],
  education: [{
    degree: 'Quản trị Kinh doanh',
    institution: 'Trường Đại học Ngoại Thương',
    start_date: '2016-09',
    end_date: '2020-06',
    description: richText('Xếp loại: Xuất sắc - GPA: 3.7/4.0\nĐạt học bổng Xuất sắc 3 năm liên tiếp.\nGiải Nhì cuộc thi Business Case Competition 2022.'),
  }],
  skills: [
    { name: 'Đàm phán & thương lượng' },
    { name: 'Phân tích thị trường' },
    { name: 'CRM (Salesforce)' },
    { name: 'Tiếng Anh (IELTS 7.0)' },
  ],
  projects: [{
    name: 'Dự án mở rộng thị trường miền Trung',
    role: 'Trưởng nhóm dự án',
    description: richText('Khảo sát và xây dựng kế hoạch thâm nhập thị trường, đạt 120% chỉ tiêu doanh số quý đầu tiên.'),
  }],
  certifications: [{
    name: 'Google Digital Marketing Fundamentals',
    issuer: 'Google',
    description: richText('Hoàn thành năm 2023.'),
  }],
  languages: [
    { name: 'Tiếng Việt', value: 'Bản ngữ' },
    { name: 'Tiếng Anh', value: 'Thành thạo' },
  ],
  awards: [{
    name: 'Top 3 Nhân viên xuất sắc bộ phận Kinh doanh',
    value: 'Năm 2024',
    description: richText(''),
  }],
}

function sampleItems(sectionKey, instanceId) {
  const items = SAMPLE_ITEMS[sectionKey] || [{ name: 'Nội dung mẫu', value: '', description: richText('Nội dung minh họa cho mục này.') }]
  return items.map((item, index) => ({ item_id: `${instanceId}_item_${index + 1}`, ...item }))
}

const DEFAULT_SECTIONS = [
  { section_key: 'summary', display_name: 'Mục tiêu nghề nghiệp', region_key: 'main' },
  { section_key: 'education', display_name: 'Học vấn', region_key: 'main' },
  { section_key: 'experience', display_name: 'Kinh nghiệm làm việc', region_key: 'main' },
  { section_key: 'skills', display_name: 'Kỹ năng', region_key: 'sidebar' },
  { section_key: 'certifications', display_name: 'Chứng chỉ', region_key: 'sidebar' },
]

function regionMapFor(templateDetail) {
  const supportsRegions = templateDetail.renderer?.capabilities?.supports_regions || ['main']
  const byKey = {}
  const source = templateDetail.sections?.length ? templateDetail.sections : DEFAULT_SECTIONS
  source.forEach((section) => {
    const region = supportsRegions.includes(section.region_key) ? section.region_key : supportsRegions[0]
    byKey[section.section_key] = region
  })
  return { byKey, fallback: supportsRegions[0] }
}

function layoutRegionsFrom(sections) {
  const regionIds = [...new Set(sections.map((section) => section.region_key || 'main'))]
  return (regionIds.length ? regionIds : ['main']).map((regionId) => ({
    id: regionId,
    width_percent: regionId === 'sidebar' ? 34 : 66,
    section_instance_ids: sections
      .filter((section) => (section.region_key || 'main') === regionId)
      .map((section) => section.instance_id),
  }))
}

function styleFor(templateDetail, themeColor) {
  return {
    theme_color: themeColor || templateDetail.theme_color || '#00A66A',
    font_family: 'Inter',
    font_scale: 1,
    line_height: 1.5,
  }
}

// Render a real per-position sample (chosen by language + position in the popup)
// laid out into the template's regions, so the left preview follows both choices.
export function buildDocumentFromSampleContent(templateDetail, sampleContent, themeColor) {
  const content = sampleContent?.content_json
  if (!content || !Array.isArray(content.sections)) return null
  const { byKey, fallback } = regionMapFor(templateDetail)
  const sections = content.sections.map((section) => ({
    ...section,
    region_key: byKey[section.section_key] || fallback,
  }))
  return {
    content_json: {
      personal_info: { ...SAMPLE_PERSONAL_INFO, ...(content.personal_info || {}), headline: content.personal_info?.headline || SAMPLE_PERSONAL_INFO.headline },
      sections: sections.map(({ region_key: _, ...section }) => section),
    },
    layout_json: { regions: layoutRegionsFrom(sections), item_orders: {} },
    style_json: styleFor(templateDetail, themeColor),
  }
}

export function buildSamplePreviewDocument(templateDetail, themeColor) {
  const supportsRegions = templateDetail.renderer?.capabilities?.supports_regions || ['main']
  const templateSections = templateDetail.sections?.length
    ? templateDetail.sections
    : DEFAULT_SECTIONS.map((section) => ({
      ...section,
      region_key: supportsRegions.includes(section.region_key) ? section.region_key : supportsRegions[0],
    }))
  const sections = templateSections.map((section, index) => {
    const instanceId = `${section.section_key}_${index + 1}`
    return {
      instance_id: instanceId,
      section_key: section.section_key,
      title: section.display_name,
      enabled: true,
      items: sampleItems(section.section_key, instanceId),
      region_key: section.region_key,
    }
  })

  const regionIds = [...new Set(sections.map((section) => section.region_key || 'main'))]
  const regions = (regionIds.length ? regionIds : ['main']).map((regionId) => ({
    id: regionId,
    width_percent: regionId === 'sidebar' ? 34 : 66,
    section_instance_ids: sections
      .filter((section) => (section.region_key || 'main') === regionId)
      .map((section) => section.instance_id),
  }))

  return {
    content_json: {
      personal_info: SAMPLE_PERSONAL_INFO,
      sections: sections.map(({ region_key: _, ...section }) => section),
    },
    layout_json: { regions, item_orders: {} },
    style_json: {
      theme_color: themeColor || templateDetail.theme_color || '#00A66A',
      font_family: 'Inter',
      font_scale: 1,
      line_height: 1.5,
    },
  }
}
