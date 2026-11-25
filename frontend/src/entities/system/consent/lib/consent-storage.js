export const CONSENT_STORAGE_KEY = 'procv_consent_v1'

export const EMPTY_CONSENT = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
}

function isBoolean(value) {
  return typeof value === 'boolean'
}

export function normalizeConsent(value) {
  if (!value || value.necessary !== true) return null
  if (!['preferences', 'analytics', 'marketing'].every((key) => isBoolean(value[key]))) return null
  return {
    necessary: true,
    preferences: value.preferences,
    analytics: value.analytics,
    marketing: value.marketing,
  }
}

export function readConsentMirror() {
  try {
    return normalizeConsent(JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)))
  } catch {
    return null
  }
}

export function writeConsentMirror(consent) {
  const normalized = normalizeConsent(consent)
  if (normalized) localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(normalized))
}

export function clearConsentMirror() {
  localStorage.removeItem(CONSENT_STORAGE_KEY)
}

// Kho tùy chọn trên trình duyệt theo nhóm (khớp trang /chinh-sach-cookie).
// Nhóm nào chưa đồng ý thì xóa ngay khi biết lựa chọn, kể cả khi màn hình sở
// hữu khóa chưa được mở lại.
const OPTIONAL_STORAGE_KEYS = {
  preferences: [
    'color-scheme',
    'search_history',
    'saved_job_filter',
    'procv_job_comparison_v1',
    'procv_employer_cv_ordering',
    'procv_admin_sidebar_collapsed',
    'procv_admin_nav_open',
  ],
  analytics: ['procv_campaign_ref_v1'],
}

export function purgeWithdrawnStorage(consent) {
  try {
    Object.entries(OPTIONAL_STORAGE_KEYS).forEach(([group, keys]) => {
      if (consent?.[group] !== true) keys.forEach((key) => localStorage.removeItem(key))
    })
  } catch {
    // Trình duyệt chặn localStorage thì cũng không có gì để xóa.
  }
}

export function hasPreferenceConsent() {
  return readConsentMirror()?.preferences === true
}
