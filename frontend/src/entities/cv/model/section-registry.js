// Client projection of the deployed canonical registry. It owns labels and a
// generic preferred region only; it never contains template-specific fields.
export const SECTION_REGISTRY = Object.freeze({
  summary: { key: 'summary', displayName: 'Mục tiêu nghề nghiệp', preferredRegion: 'main', allowMultiple: false, requiresItems: false },
  experience: { key: 'experience', displayName: 'Kinh nghiệm làm việc', preferredRegion: 'main', allowMultiple: true, requiresItems: true },
  education: { key: 'education', displayName: 'Học vấn', preferredRegion: 'main', allowMultiple: true, requiresItems: true },
  skills: { key: 'skills', displayName: 'Kỹ năng', preferredRegion: 'sidebar', allowMultiple: false, requiresItems: true },
  projects: { key: 'projects', displayName: 'Dự án', preferredRegion: 'main', allowMultiple: true, requiresItems: true },
  certifications: { key: 'certifications', displayName: 'Chứng chỉ', preferredRegion: 'sidebar', allowMultiple: true, requiresItems: true },
  languages: { key: 'languages', displayName: 'Ngôn ngữ', preferredRegion: 'sidebar', allowMultiple: false, requiresItems: true },
  awards: { key: 'awards', displayName: 'Giải thưởng', preferredRegion: 'main', allowMultiple: true, requiresItems: true },
  custom: { key: 'custom', displayName: 'Nội dung tùy chỉnh', preferredRegion: 'main', allowMultiple: true, requiresItems: false },
})

export function getSectionDefinition(sectionKey) {
  return SECTION_REGISTRY[sectionKey]
}
