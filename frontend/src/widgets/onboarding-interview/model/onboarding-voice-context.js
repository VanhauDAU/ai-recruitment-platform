import { createContext, useContext } from 'react'

/**
 * Giá trị mặc định khi không có provider: robot câm nhưng mọi bề mặt vẫn render
 * bình thường (phụ đề tự chạy typewriter). Nhờ vậy test một màn onboarding lẻ
 * không phải dựng cả provider.
 */
const SILENT_VOICE = Object.freeze({
  available: false,
  elapsed: 0,
  enabled: false,
  error: '',
  replay: () => {},
  speakOnce: () => {},
  speaking: false,
  status: 'idle',
  stop: () => {},
  toggle: () => {},
  unlock: () => false,
})

export const OnboardingVoiceContext = createContext(SILENT_VOICE)

export function useOnboardingVoice() {
  return useContext(OnboardingVoiceContext)
}
