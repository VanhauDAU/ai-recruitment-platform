import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingVoiceProvider from './OnboardingVoiceProvider'
import { useOnboardingVoice } from './onboarding-voice-context'

const mocks = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn(), unlock: vi.fn() }))

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
    mocks.speak.mockReset()
    mocks.stop.mockReset()
    mocks.unlock.mockReset().mockReturnValue(true)
  })

  it('đọc ngay, không chờ ai bấm nút bật tiếng', () => {
    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })

    act(() => result.current.speakOnce('step-1', 'Xin chào'))

    expect(mocks.unlock).toHaveBeenCalled()
    expect(mocks.speak).toHaveBeenCalledExactlyOnceWith('Xin chào')
  })

  it('chỉ đọc mỗi câu một lần dù bước được render lại', () => {
    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })

    act(() => result.current.speakOnce('step-1', 'Xin chào'))
    act(() => result.current.speakOnce('step-1', 'Xin chào'))

    expect(mocks.speak).toHaveBeenCalledExactlyOnceWith('Xin chào')
  })

  it('thao tác đầu tiên của ứng viên resume audio còn bị treo', async () => {
    const user = userEvent.setup()
    render(<OnboardingVoiceProvider><button type="button">bất kỳ</button></OnboardingVoiceProvider>)

    await user.click(screen.getByRole('button', { name: 'bất kỳ' }))

    expect(mocks.unlock).toHaveBeenCalled()
  })

  it('nghe lại phát lại đúng câu đang hiện', () => {
    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })

    act(() => result.current.replay('step-1', 'Đọc lại'))

    expect(mocks.speak).toHaveBeenCalledWith('Đọc lại')
  })

  it('tắt tiếng thì dừng phát, không đọc nữa và nhớ cho lần sau', async () => {
    const user = userEvent.setup()
    function Probe() {
      const voice = useOnboardingVoice()
      return (
        <>
          <button type="button" onClick={voice.toggle}>toggle</button>
          <button type="button" onClick={() => voice.speakOnce('step-1', 'Xin chào')}>speak</button>
        </>
      )
    }
    render(<OnboardingVoiceProvider><Probe /></OnboardingVoiceProvider>)

    await user.click(screen.getByRole('button', { name: 'toggle' }))
    await user.click(screen.getByRole('button', { name: 'speak' }))

    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.speak).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('procv_onboarding_voice_v1')).toBe('off')
  })

  it('nhớ lựa chọn tắt tiếng của lượt trước', () => {
    window.localStorage.setItem('procv_onboarding_voice_v1', 'off')
    const { result } = renderHook(() => useOnboardingVoice(), { wrapper })

    expect(result.current.enabled).toBe(false)
  })

  it('trả về bản câm khi dùng ngoài provider để màn lẻ vẫn render được', () => {
    const { result } = renderHook(() => useOnboardingVoice())

    act(() => result.current.speakOnce('step-1', 'Xin chào'))

    expect(result.current.enabled).toBe(false)
    expect(mocks.speak).not.toHaveBeenCalled()
  })
})
