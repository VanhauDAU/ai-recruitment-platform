import { Suspense, useEffect, useState } from 'react'
import { message } from '@/shared/lib/toast'
import { useConsent } from '@/entities/system/consent'
import { CookieConsentBanner, CookiePreferencesModal } from '@/features/common/privacy/cookie-consent'

const OPTIONAL_OFF = { necessary: true, preferences: false, analytics: false, marketing: false }
const ALL_ON = { necessary: true, preferences: true, analytics: true, marketing: true }

export default function CookieConsentLayer() {
  const { consent, status, isDecided, isEnabled, isBannerVisible, dismissBanner, settingsOpen, openSettings, closeSettings, updateConsent } = useConsent()
  const [saving, setSaving] = useState(false)
  // Mount the lazy modal on first open and keep it, so closing still animates.
  const [modalMounted, setModalMounted] = useState(false)
  useEffect(() => {
    if (settingsOpen) setModalMounted(true)
  }, [settingsOpen])

  function sameConsent(left, right) {
    return ['preferences', 'analytics', 'marketing'].every((key) => left?.[key] === right?.[key])
  }

  async function save(next) {
    const requested = next || consent
    // Opening settings and pressing “Chấp nhận tất cả” again is a UI action,
    // not a new write. Avoid consuming the consent throttle for an idempotent
    // choice (especially useful when the user reopens the footer settings).
    if (isDecided && sameConsent(requested, consent)) {
      closeSettings()
      return
    }
    setSaving(true)
    try {
      await updateConsent(requested)
      closeSettings()
    } catch (error) {
      if (error?.response?.status === 429) {
        const retryAfter = Number(error.response.headers?.['retry-after'])
        const minutes = Number.isFinite(retryAfter) ? Math.max(1, Math.ceil(retryAfter / 60)) : null
        message.error(`Bạn vừa gửi quá nhiều lần. Vui lòng thử lại sau${minutes ? ` khoảng ${minutes} phút` : ' ít phút'}.`)
        closeSettings()
      } else if (!error?.response) {
        message.error('Không kết nối được máy chủ để lưu cookie. Vui lòng kiểm tra backend đang chạy.')
      } else {
        message.error('Không thể lưu lựa chọn cookie. Các cookie tùy chọn vẫn đang tắt.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!isEnabled) return null
  const canRender = status === 'ready' || status === 'error'
  if (!canRender) return null

  return (
    <>
      {isBannerVisible && <CookieConsentBanner onAcceptAll={() => save(ALL_ON)} onCustomize={openSettings} onDismiss={dismissBanner} onRejectOptional={() => save(OPTIONAL_OFF)} saving={saving} />}
      {modalMounted && (
        <Suspense fallback={null}>
          <CookiePreferencesModal open={settingsOpen} consent={consent} onClose={closeSettings} onSave={save} saving={saving} />
        </Suspense>
      )}
    </>
  )
}
