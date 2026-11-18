import { useCallback, useEffect, useMemo, useState } from 'react'
import { getConsent, saveConsent } from '../api/consent.api'
import { EMPTY_CONSENT, clearConsentMirror, normalizeConsent, readConsentMirror, writeConsentMirror } from '../lib/consent-storage'
import { ConsentContext } from './consent-context'

const COOKIE_CONSENT_ENABLED = import.meta.env.VITE_COOKIE_CONSENT_ENABLED !== 'false'

export default function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => readConsentMirror() || EMPTY_CONSENT)
  const [status, setStatus] = useState(COOKIE_CONSENT_ENABLED ? 'loading' : 'disabled')
  const [isDecided, setIsDecided] = useState(() => Boolean(readConsentMirror()))
  const [settingsOpen, setSettingsOpen] = useState(false)

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
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        // Fail closed: a stale UI mirror must never enable Analytics.
        setConsent(EMPTY_CONSENT)
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
    setIsDecided(true)
    setStatus('ready')
    return saved
  }, [])

  const value = useMemo(() => ({
    consent,
    status,
    isDecided,
    isEnabled: COOKIE_CONSENT_ENABLED,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    updateConsent,
  }), [consent, isDecided, settingsOpen, status, updateConsent])

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
