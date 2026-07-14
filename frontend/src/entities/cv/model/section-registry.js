// Client projection of the deployed canonical registry. It owns labels and a
// generic preferred region only; it never contains template-specific fields.
export const SECTION_REGISTRY = Object.freeze({
  summary: { key: 'summary', displayName: 'Mục tiêu nghề nghiệp', preferredRegion: 'main' },
  experience: { key: 'experience', displayName: 'Kinh nghiệm làm việc', preferredRegion: 'main' },
  education: { key: 'education', displayName: 'Học vấn', preferredRegion: 'main' },
  skills: { key: 'skills', displayName: 'Kỹ năng', preferredRegion: 'sidebar' },
  projects: { key: 'projects', displayName: 'Dự án', preferredRegion: 'main' },
  certifications: { key: 'certifications', displayName: 'Chứng chỉ', preferredRegion: 'sidebar' },
  languages: { key: 'languages', displayName: 'Ngôn ngữ', preferredRegion: 'sidebar' },
  awards: { key: 'awards', displayName: 'Giải thưởng', preferredRegion: 'main' },
  custom: { key: 'custom', displayName: 'Nội dung tùy chỉnh', preferredRegion: 'main' },
})

export function getSectionDefinition(sectionKey) {
  return SECTION_REGISTRY[sectionKey]
}
