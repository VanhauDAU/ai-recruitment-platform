// Ngôn ngữ nội dung CV — khớp enum backend `CvLanguage`
// (backend/apps/cv_templates/models/language.py). Là hằng của sản phẩm,
// không tải từ API.
export const CV_LANGUAGES = [
  { code: 'vi-VN', param: 'vi', label: 'Tiếng Việt', inlineLabel: 'tiếng Việt', flag: '🇻🇳' },
  { code: 'en-US', param: 'en', label: 'Tiếng Anh', inlineLabel: 'tiếng Anh', flag: '🇬🇧' },
]

export function cvLanguage(code) {
  return CV_LANGUAGES.find((language) => language.code === code) || CV_LANGUAGES[0]
}
