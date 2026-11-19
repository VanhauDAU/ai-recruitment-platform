// Nền tảng song ngữ vi/en cho cả ba cổng (Paraglide JS, ADR-0023).
// Chuỗi nằm ở frontend/messages/<vùng>/{vi,en}.json; plugin Vite biên dịch
// thành ./paraglide (không commit). Mỗi chuỗi là một hàm `m.key()` nên chunk
// nào dùng chuỗi nào chỉ chứa chuỗi đó.
import {
  baseLocale,
  getLocale,
  isLocale,
  locales,
  overwriteGetLocale,
  setLocale,
} from './paraglide/runtime.js'

export { m } from './paraglide/messages.js'

export const SUPPORTED_LOCALES = locales
export const DEFAULT_LOCALE = baseLocale
// Trùng `localStorageKey` trong vite.config.js.
export const LOCALE_STORAGE_KEY = 'procv_lang'
const LEGACY_STORAGE_KEY = 'employer_marketing_lang'

const INTL_LOCALES = { vi: 'vi-VN', en: 'en-US' }
const OG_LOCALES = { vi: 'vi_VN', en: 'en_US' }

// Trước 11/2026 chỉ cổng marketing NTD có i18n và lưu ở khóa riêng; chuyển một
// lần để người đã chọn tiếng Anh không bị trả về tiếng Việt.
function migrateLegacyStorage() {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy === null) return
    if (!localStorage.getItem(LOCALE_STORAGE_KEY) && isLocale(legacy)) {
      localStorage.setItem(LOCALE_STORAGE_KEY, legacy)
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // localStorage bị chặn: dùng ngôn ngữ mặc định.
  }
}

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : baseLocale
  } catch {
    return baseLocale
  }
}

migrateLegacyStorage()

// Runtime mặc định đọc localStorage ở MỖI lần gọi m.key(). Đổi ngôn ngữ luôn
// tải lại trang nên chỉ cần đọc một lần lúc khởi động.
let currentLocale = readStoredLocale()
overwriteGetLocale(() => currentLocale)
if (typeof document !== 'undefined') document.documentElement.lang = currentLocale

export { getLocale }

/** Locale BCP 47 cho Intl/toLocale*: 'vi-VN' | 'en-US'. */
export function getIntlLocale() {
  return INTL_LOCALES[getLocale()] ?? INTL_LOCALES[baseLocale]
}

export function getOgLocale() {
  return OG_LOCALES[getLocale()] ?? OG_LOCALES[baseLocale]
}

/**
 * Đổi ngôn ngữ giao diện: lưu lựa chọn rồi tải lại trang để antd, dayjs, cache
 * react-query và dữ liệu API (backend dịch theo Accept-Language) cùng làm mới.
 * `reload: false` chỉ dành cho test.
 */
export function changeLocale(locale, { reload = true } = {}) {
  if (!isLocale(locale) || locale === getLocale()) return false
  setLocale(locale, { reload: false })
  // Không lưu được (localStorage bị chặn) thì tải lại sẽ quay về ngôn ngữ cũ và
  // có thể lặp vô hạn khi đồng bộ theo tài khoản; giữ nguyên trang.
  if (reload && readStoredLocale() !== locale) return false
  currentLocale = locale
  if (reload) {
    window.location.reload()
    return true
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  return true
}
