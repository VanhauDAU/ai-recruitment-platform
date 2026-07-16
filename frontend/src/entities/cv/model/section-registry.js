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
  nameplate: { key: 'nameplate', displayName: 'Danh thiếp', preferredRegion: 'header', allowMultiple: false, requiresItems: false, initialItem: false, deletable: false, personalInfoBacked: true, draggable: true, itemDraggable: false },
  contact: { key: 'contact', displayName: 'Thông tin liên hệ', preferredRegion: 'header', allowMultiple: false, requiresItems: false, initialItem: false, deletable: true, personalInfoBacked: true, draggable: true, itemDraggable: false },
  avatar: { key: 'avatar', displayName: 'Ảnh đại diện', preferredRegion: 'header', allowMultiple: false, requiresItems: false, initialItem: false, deletable: true, personalInfoBacked: true, draggable: true, itemDraggable: false },
})

const SECTION_LABELS = Object.freeze({
  'vi-VN': Object.fromEntries(Object.values(SECTION_REGISTRY).map(({ key, displayName }) => [key, displayName])),
  'en-US': {
    summary: 'Career objective', experience: 'Work experience', education: 'Education', skills: 'Skills', projects: 'Projects', certifications: 'Certifications', languages: 'Languages', awards: 'Awards', custom: 'Additional information', activities: 'Activities', references: 'References', interests: 'Interests', nameplate: 'Profile', contact: 'Contact information', avatar: 'Profile photo',
  },
  'ja-JP': {
    summary: 'キャリア目標', experience: '職務経歴', education: '学歴', skills: 'スキル', projects: 'プロジェクト', certifications: '資格', languages: '語学力', awards: '受賞歴', custom: 'その他', activities: '活動', references: '推薦者', interests: '趣味', nameplate: 'プロフィール', contact: '連絡先', avatar: 'プロフィール写真',
  },
  'zh-CN': {
    summary: '职业目标', experience: '工作经历', education: '教育背景', skills: '技能', projects: '项目经历', certifications: '证书', languages: '语言能力', awards: '荣誉奖项', custom: '其他信息', activities: '活动经历', references: '推荐人', interests: '兴趣爱好', nameplate: '个人资料', contact: '联系方式', avatar: '个人照片',
  },
})

const UI_TEXT = Object.freeze({
  'vi-VN': {
    full_name: 'Họ và tên', headline: 'Chức danh mong muốn', email: 'Email', phone: 'Số điện thoại', address: 'Địa chỉ',
    role: 'Vị trí công việc', company: 'Công ty', name: 'Tên', degree: 'Bằng cấp', institution: 'Trường học', title: 'Tiêu đề', value: 'Nội dung', issuer: 'Đơn vị cấp', organization: 'Tổ chức',
    section_title: 'Tiêu đề mục', add_item: 'Thêm nội dung', upload_avatar: 'Tải ảnh', contact_info: 'Thông tin liên hệ', content_item: 'Mục nội dung',
  },
  'en-US': {
    full_name: 'Full name', headline: 'Desired job title', email: 'Email', phone: 'Phone number', address: 'Address',
    role: 'Job title', company: 'Company', name: 'Name', degree: 'Degree', institution: 'School', title: 'Title', value: 'Content', issuer: 'Issuer', organization: 'Organization',
    section_title: 'Section title', add_item: 'Add content', upload_avatar: 'Upload photo', contact_info: 'Contact information', content_item: 'Content item',
  },
  'ja-JP': {
    full_name: '氏名', headline: '希望職種', email: 'メールアドレス', phone: '電話番号', address: '住所',
    role: '役職', company: '会社名', name: '名前', degree: '学位', institution: '学校名', title: 'タイトル', value: '内容', issuer: '発行機関', organization: '団体',
    section_title: '見出し', add_item: '内容を追加', upload_avatar: '写真をアップロード', contact_info: '連絡先', content_item: '項目',
  },
  'zh-CN': {
    full_name: '姓名', headline: '求职意向', email: '电子邮箱', phone: '电话号码', address: '地址',
    role: '职位名称', company: '公司', name: '名称', degree: '学历', institution: '学校', title: '标题', value: '内容', issuer: '颁发机构', organization: '组织',
    section_title: '模块标题', add_item: '添加内容', upload_avatar: '上传照片', contact_info: '联系方式', content_item: '内容项目',
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
