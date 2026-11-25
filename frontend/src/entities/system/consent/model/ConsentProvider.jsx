import { useCallback, useEffect, useMemo, useState } from 'react'
import { getConsent, saveConsent } from '../api/consent.api'
import {
  EMPTY_CONSENT,
  clearConsentMirror,
  normalizeConsent,
  purgeWithdrawnStorage,
  readConsentMirror,
  writeConsentMirror,
} from '../lib/consent-storage'
import { ConsentContext } from './consent-context'

const COOKIE_CONSENT_ENABLED = import.meta.env.VITE_COOKIE_CONSENT_ENABLED !== 'false'
// Đóng banner (nút ✕ trên điện thoại) chỉ ẩn trong phiên này, không ghi lựa
// chọn: cookie tùy chọn vẫn tắt như khi chưa quyết định. Khóa này là cookie
// thiết yếu vì chỉ nhớ việc đã đóng thông báo đồng ý.
const BANNER_DISMISSED_KEY = 'procv_cookie_banner_dismissed'

function readBannerDismissed() {
  try {
    return sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => readConsentMirror() || EMPTY_CONSENT)
  const [status, setStatus] = useState(COOKIE_CONSENT_ENABLED ? 'loading' : 'disabled')
  const [isDecided, setIsDecided] = useState(() => Boolean(readConsentMirror()))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(readBannerDismissed)

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true)
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1')
    } catch {
      // Chế độ riêng tư chặn sessionStorage: vẫn ẩn tới khi tải lại trang.
    }
  }, [])

  useEffect(() => {
    if (!COOKIE_CONSENT_ENABLED) return undefined
    let active = true
    getConsent()
      .then((serverConsent) => {
        if (!active) return
        const normalized = normalizeConsent(serverConsent)
        if (normalized) {
          setConsent(normalized)
          writeConsentMirror(normalized)
          setIsDecided(true)
        } else {
          setConsent(EMPTY_CONSENT)
          clearConsentMirror()
          setIsDecided(false)
        }
        purgeWithdrawnStorage(normalized)
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        // Fail closed: a stale UI mirror must never enable optional storage
        // (hasPreferenceConsent reads it) or Analytics.
        setConsent(EMPTY_CONSENT)
        clearConsentMirror()
        purgeWithdrawnStorage(EMPTY_CONSENT)
        setStatus('error')
        setIsDecided(false)
      })
    return () => { active = false }
  }, [])

  const updateConsent = useCallback(async (nextConsent) => {
    const normalized = normalizeConsent({ ...EMPTY_CONSENT, ...nextConsent })
    if (!normalized) throw new Error('Lựa chọn cookie không hợp lệ.')
    const saved = normalizeConsent(await saveConsent(normalized))
    if (!saved) throw new Error('Không thể lưu lựa chọn cookie.')
    setConsent(saved)
    writeConsentMirror(saved)
    purgeWithdrawnStorage(saved)
    setIsDecided(true)
    setStatus('ready')
    return saved
  }, [])

  const value = useMemo(() => ({
    consent,
    status,
    isDecided,
    isEnabled: COOKIE_CONSENT_ENABLED,
    isBannerVisible: COOKIE_CONSENT_ENABLED && !isDecided && !bannerDismissed,
    dismissBanner,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    updateConsent,
  }), [bannerDismissed, consent, dismissBanner, isDecided, settingsOpen, status, updateConsent])

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
