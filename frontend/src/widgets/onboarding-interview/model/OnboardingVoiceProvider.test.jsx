import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingVoiceProvider from './OnboardingVoiceProvider'
import { useOnboardingVoice } from './onboarding-voice-context'

const { mocks, siteSettings } = vi.hoisted(() => ({
  mocks: { speak: vi.fn(), stop: vi.fn(), unlock: vi.fn() },
  siteSettings: { speech_onboarding_enabled: true },
}))

vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ settings: siteSettings }),
}))

vi.mock('@/features/speak-text', () => ({
  useSpeak: () => ({
    elapsed: 0,
    error: '',
    speak: mocks.speak,
    speaking: false,
    status: 'idle',
    stop: mocks.stop,
    unlock: mocks.unlock,
  }),
}))

const wrapper = ({ children }) => <OnboardingVoiceProvider>{children}</OnboardingVoiceProvider>

describe('OnboardingVoiceProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    siteSettings.speech_onboarding_enabled = true
    vi.clearAllMocks()
    mocks.unlock.mockReturnValue(true)
  })

  it('defaults to opt-out and never speaks automatically', () => {
    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })

    act(() => result.current.speakOnce('step-1', 'Xin chào'))

    expect(result.current.available).toBe(true)
    expect(result.current.enabled).toBe(false)
    expect(mocks.speak).not.toHaveBeenCalled()
  })

  it('speaks once only after the user explicitly opts in', () => {
    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })

    act(() => result.current.toggle())
    act(() => result.current.speakOnce('step-1', 'Xin chào'))
    act(() => result.current.speakOnce('step-1', 'Xin chào'))

    expect(result.current.enabled).toBe(true)
    expect(mocks.unlock).toHaveBeenCalled()
    expect(mocks.speak).toHaveBeenCalledExactlyOnceWith('Xin chào')
    expect(window.localStorage.getItem('procv_onboarding_voice_v1')).toBe('on')
  })

  it('stays unavailable even when local storage was previously on', () => {
    window.localStorage.setItem('procv_onboarding_voice_v1', 'on')
    siteSettings.speech_onboarding_enabled = false

    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })
    act(() => result.current.speakOnce('step-1', 'Xin chào'))

    expect(result.current.available).toBe(false)
    expect(result.current.enabled).toBe(false)
    expect(mocks.speak).not.toHaveBeenCalled()
  })

  it('returns a silent fallback outside the provider', () => {
    const { result } = renderHook(() => useOnboardingVoice())

    expect(result.current.available).toBe(false)
    expect(result.current.enabled).toBe(false)
  })
})
