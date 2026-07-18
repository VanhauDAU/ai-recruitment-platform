// i18n cho CỔNG MARKETING NTD — phần còn lại của site vẫn tiếng Việt thuần.
// Module này chỉ được import từ chunk employer marketing (layout + pages);
// import từ main/admin sẽ kéo i18next vào bundle của cổng đó, đừng làm vậy.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import employerVi from './locales/employer-vi.json'
import employerEn from './locales/employer-en.json'

export const EMPLOYER_NS = 'employer'
export const LANGUAGE_STORAGE_KEY = 'employer_marketing_lang'
export const SUPPORTED_LANGUAGES = ['vi', 'en']

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : 'vi'
  } catch {
    return 'vi'
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: readStoredLanguage(),
    fallbackLng: 'vi',
    ns: [EMPLOYER_NS],
    defaultNS: EMPLOYER_NS,
    resources: {
      vi: { [EMPLOYER_NS]: employerVi },
      en: { [EMPLOYER_NS]: employerEn },
    },
    interpolation: { escapeValue: false },
  })
  document.documentElement.lang = i18n.language
}

export function changeAppLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return
  i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // localStorage bị chặn (private mode) — ngôn ngữ vẫn đổi trong phiên.
  }
}

export default i18n
