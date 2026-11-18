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

export function hasPreferenceConsent() {
  return readConsentMirror()?.preferences === true
}
