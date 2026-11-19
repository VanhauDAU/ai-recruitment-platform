// Client projection of the deployed canonical registry. It owns labels and a
// generic preferred region only; it never contains template-specific fields.
export const SECTION_REGISTRY = Object.freeze({
  summary: { key: 'summary', displayName: 'Mục tiêu nghề nghiệp', preferredRegion: 'main', allowMultiple: false, requiresItems: false, initialItem: true, deletable: true, draggable: true, itemDraggable: false },
  experience: { key: 'experience', displayName: 'Kinh nghiệm làm việc', preferredRegion: 'main', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: true },
  education: { key: 'education', displayName: 'Học vấn', preferredRegion: 'main', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: true },
  skills: { key: 'skills', displayName: 'Kỹ năng', preferredRegion: 'sidebar', allowMultiple: false, requiresItems: true, draggable: true, itemDraggable: true },
  projects: { key: 'projects', displayName: 'Dự án', preferredRegion: 'main', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: true },
  certifications: { key: 'certifications', displayName: 'Chứng chỉ', preferredRegion: 'sidebar', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: true },
  languages: { key: 'languages', displayName: 'Ngôn ngữ', preferredRegion: 'sidebar', allowMultiple: false, requiresItems: true, draggable: true, itemDraggable: false },
  awards: { key: 'awards', displayName: 'Giải thưởng', preferredRegion: 'main', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: false },
  custom: { key: 'custom', displayName: 'Nội dung tùy chỉnh', preferredRegion: 'main', allowMultiple: true, requiresItems: false, draggable: true, itemDraggable: false },
  activities: { key: 'activities', displayName: 'Hoạt động', preferredRegion: 'main', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: true },
  references: { key: 'references', displayName: 'Người tham chiếu', preferredRegion: 'main', allowMultiple: true, requiresItems: true, draggable: true, itemDraggable: true },
  interests: { key: 'interests', displayName: 'Sở thích', preferredRegion: 'sidebar', allowMultiple: false, requiresItems: true, draggable: true, itemDraggable: true },
  // CVT-3: trường riêng của vị trí; các item do backend chụp từ định nghĩa vị trí,
  // ứng viên chỉ điền giá trị (không thêm/xóa item, không thêm mục từ thư viện).
  position_details: { key: 'position_details', displayName: 'Thông tin chuyên môn', preferredRegion: 'sidebar', allowMultiple: false, requiresItems: false, initialItem: false, deletable: true, positionBacked: true, draggable: true, itemDraggable: false },
  portfolio: { key: 'portfolio', displayName: 'Portfolio', preferredRegion: 'main', allowMultiple: false, requiresItems: true, draggable: true, itemDraggable: true },
  publications: { key: 'publications', displayName: 'Công bố', preferredRegion: 'main', allowMultiple: false, requiresItems: true, draggable: true, itemDraggable: true },
  nameplate: { key: 'nameplate', displayName: 'Danh thiếp', preferredRegion: 'header', allowMultiple: false, requiresItems: false, initialItem: false, deletable: false, personalInfoBacked: true, draggable: true, itemDraggable: false },
  contact: { key: 'contact', displayName: 'Thông tin liên hệ', preferredRegion: 'header', allowMultiple: false, requiresItems: false, initialItem: false, deletable: false, personalInfoBacked: true, draggable: true, itemDraggable: false },
  // Templates without a header region place the photo at the top of the
  // sidebar so it stays next to the candidate's name instead of page bottom.
  avatar: { key: 'avatar', displayName: 'Ảnh đại diện', preferredRegion: 'header', fallbackRegions: ['sidebar'], insertAtStart: true, allowMultiple: false, requiresItems: false, initialItem: false, deletable: true, personalInfoBacked: true, draggable: true, itemDraggable: false },
})

const SECTION_LABELS = Object.freeze({
  'vi-VN': Object.fromEntries(Object.values(SECTION_REGISTRY).map(({ key, displayName }) => [key, displayName])),
  'en-US': {
    summary: 'Career objective', experience: 'Work experience', education: 'Education', skills: 'Skills', projects: 'Projects', certifications: 'Certifications', languages: 'Languages', awards: 'Awards', custom: 'Additional information', activities: 'Activities', references: 'References', interests: 'Interests', position_details: 'Professional details', portfolio: 'Portfolio', publications: 'Publications', nameplate: 'Profile', contact: 'Contact information', avatar: 'Profile photo',
  },
})

const UI_TEXT = Object.freeze({
  'vi-VN': {
    full_name: 'Họ và tên', headline: 'Chức danh mong muốn', email: 'Email', phone: 'Số điện thoại', address: 'Địa chỉ', website: 'Website', date_of_birth: 'Ngày sinh (vd: 1999-05-20)', start_date: 'Từ (vd: 2020-01)', end_date: 'Đến (vd: 2023-12)',
    role: 'Vị trí công việc', company: 'Công ty', name: 'Tên', degree: 'Bằng cấp', institution: 'Trường học', title: 'Tiêu đề', value: 'Nội dung', issuer: 'Đơn vị cấp', organization: 'Tổ chức',
    section_title: 'Tiêu đề mục', add_item: 'Thêm nội dung', choose: 'Chọn…', upload_avatar: 'Tải ảnh', contact_info: 'Thông tin liên hệ', content_item: 'Mục nội dung',
    summary_hint: 'Mục tiêu nghề nghiệp của bạn, gồm mục tiêu ngắn hạn và dài hạn',
    description_hint: 'Mô tả chi tiết', description_hint_experience: 'Mô tả kinh nghiệm làm việc của bạn', description_hint_education: 'Mô tả quá trình học tập hoặc thành tích của bạn', description_hint_projects: 'Mô tả dự án, vai trò và kết quả đạt được',
  },
  'en-US': {
    full_name: 'Full name', headline: 'Desired job title', email: 'Email', phone: 'Phone number', address: 'Address', website: 'Website', date_of_birth: 'Date of birth (e.g. 1999-05-20)', start_date: 'From (e.g. 2020-01)', end_date: 'To (e.g. 2023-12)',
    role: 'Job title', company: 'Company', name: 'Name', degree: 'Degree', institution: 'School', title: 'Title', value: 'Content', issuer: 'Issuer', organization: 'Organization',
    section_title: 'Section title', add_item: 'Add content', choose: 'Select…', upload_avatar: 'Upload photo', contact_info: 'Contact information', content_item: 'Content item',
    summary_hint: 'Your career objective, including short and long term goals',
    description_hint: 'Details', description_hint_experience: 'Describe your work experience', description_hint_education: 'Describe your studies or achievements', description_hint_projects: 'Describe the project, your role and the results',
  },
})

export function getSectionDefinition(sectionKey) {
  return SECTION_REGISTRY[sectionKey]
}

export function getSectionDisplayName(sectionKey, locale = 'vi-VN') {
  return SECTION_LABELS[locale]?.[sectionKey]
    || SECTION_LABELS['vi-VN'][sectionKey]
    || sectionKey
}

export function getCvUiText(key, locale = 'vi-VN') {
  return UI_TEXT[locale]?.[key]
    || UI_TEXT['vi-VN'][key]
    || key
}
