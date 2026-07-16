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

export function getSectionDefinition(sectionKey) {
  return SECTION_REGISTRY[sectionKey]
}
