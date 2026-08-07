import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSiteSettings } from '@/entities/site-settings'
import { useSpeak } from '@/features/speak-text'
import { OnboardingVoiceContext } from './onboarding-voice-context'

const VOICE_STORAGE_KEY = 'procv_onboarding_voice_v1'
const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart']

function storedEnabled() {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function storeEnabled(enabled) {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage bị chặn thì chỉ mất lựa chọn cho lượt sau, không ảnh hưởng phát.
  }
}

/**
 * Giọng đọc dùng chung cho cả luồng onboarding.
 *
 * Provider phải nằm ở layout chứ không phải trong page: trình duyệt chỉ cho mở
 * AudioContext trong cử chỉ người dùng, mà cử chỉ mở luồng là nút "Bắt đầu
 * thôi!" trả lời lời chào. Nếu `useSpeak` sống trong page thì mỗi lần page
 * unmount, player bị destroy và context đã unlock mất theo.
 *
 * `speakOnce` chỉ đọc mỗi câu một lần: quay lại bước cũ không phát lại, vừa đỡ
 * phiền vừa không đốt hạn mức. Người dùng phải chủ động bật giọng đọc trước.
 */
export default function OnboardingVoiceProvider({ children }) {
  const { settings } = useSiteSettings()
  const available = settings.speech_onboarding_enabled === true
  const { elapsed, error, speak, speaking, status, stop, unlock } = useSpeak({
    surface: 'onboarding',
  })
  const [optedIn, setOptedIn] = useState(storedEnabled)
  const enabled = available && optedIn
  const spokenIdsRef = useRef(new Set())

  useEffect(() => {
    if (!available) stop()
  }, [available, stop])

  useEffect(() => {
    if (!enabled) return undefined
    const resume = () => unlock()
    for (const event of GESTURE_EVENTS) {
      window.addEventListener(event, resume, { capture: true, once: true, passive: true })
    }
    return () => {
      for (const event of GESTURE_EVENTS) {
        window.removeEventListener(event, resume, { capture: true })
      }
    }
  }, [enabled, unlock])

  const say = useCallback((id, text) => {
    if (!enabled || !text) return
    spokenIdsRef.current.add(id)
    unlock()
    speak(text)
  }, [enabled, speak, unlock])

  const speakOnce = useCallback((id, text) => {
    if (spokenIdsRef.current.has(id)) return
    say(id, text)
  }, [say])

  const toggle = useCallback(() => {
    if (!available) return
    const next = !enabled
    setOptedIn(next)
    storeEnabled(next)
    if (next) unlock()
    else stop()
  }, [available, enabled, stop, unlock])

  const value = useMemo(() => ({
    available,
    elapsed,
    enabled,
    error,
    replay: say,
    speakOnce,
    speaking,
    status,
    stop,
    toggle,
    unlock,
  }), [available, elapsed, enabled, error, say, speakOnce, speaking, status, stop, toggle, unlock])

  return <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
}
