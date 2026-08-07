import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssistantVoice } from './use-assistant-voice'

const { useSpeak, voice } = vi.hoisted(() => {
  const voice = {
    speak: vi.fn(),
    speaking: false,
    status: 'idle',
    stop: vi.fn(),
  }
  return { useSpeak: vi.fn(() => voice), voice }
})

vi.mock('@/features/speak-text', () => ({ useSpeak }))

describe('useAssistantVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    voice.speaking = false
    voice.status = 'idle'
  })

  it('never speaks until the user clicks a message', () => {
    const { result } = renderHook(() => useAssistantVoice(true))

    expect(useSpeak).toHaveBeenCalledWith({ surface: 'chatbot' })
    expect(voice.speak).not.toHaveBeenCalled()

    act(() => result.current.toggleMessage('assistant-1', 'Bạn có thể tìm việc ở đây.'))

    expect(voice.speak).toHaveBeenCalledExactlyOnceWith('Bạn có thể tìm việc ở đây.')
    expect(result.current.activeMessageId).toBe('assistant-1')
  })

  it('stops the active message instead of starting a second stream', () => {
    voice.speaking = true
    const { result } = renderHook(() => useAssistantVoice(true))
    act(() => result.current.toggleMessage('assistant-1', 'Tin nhắn'))

    act(() => result.current.toggleMessage('assistant-1', 'Tin nhắn'))

    expect(voice.stop).toHaveBeenCalledOnce()
    expect(voice.speak).toHaveBeenCalledOnce()
  })

  it('does not call speech when the public policy is disabled', () => {
    const { result } = renderHook(() => useAssistantVoice(false))

    act(() => result.current.toggleMessage('assistant-1', 'Tin nhắn'))

    expect(voice.speak).not.toHaveBeenCalled()
    expect(voice.stop).toHaveBeenCalled()
  })
})
