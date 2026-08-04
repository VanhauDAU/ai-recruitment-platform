import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssistantVoice } from './use-assistant-voice'

const { useSpeak, voice } = vi.hoisted(() => {
  const voice = {
    elapsed: 0,
    error: '',
    speak: vi.fn(),
    speaking: false,
    status: 'idle',
    stop: vi.fn(),
    unlock: vi.fn(),
  }
  return { useSpeak: vi.fn(() => voice), voice }
})

vi.mock('@/features/speak-text', () => ({ useSpeak }))

const GREETING = { id: 'assistant-0', from: 'assistant', text: 'Xin chào, tôi là trợ lý ProCV.' }
const QUESTION = { id: 'user-1', from: 'user', text: 'Tìm việc ở đâu?' }
const REPLY = { id: 'assistant-1', from: 'assistant', text: 'Bạn có thể tìm việc ở mục Việc làm.' }

describe('useAssistantVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('đọc câu trả lời mới cho câu hỏi của người dùng', () => {
    const { rerender } = renderHook(({ messages }) => useAssistantVoice(messages), {
      initialProps: { messages: [GREETING] },
    })

    rerender({ messages: [GREETING, QUESTION] })
    rerender({ messages: [GREETING, QUESTION, REPLY] })

    expect(voice.speak).toHaveBeenCalledTimes(1)
    expect(voice.speak).toHaveBeenCalledWith(REPLY.text)
  })

  it('đánh dấu đúng response đang cần đồng bộ với giọng đọc', () => {
    const { rerender, result } = renderHook(({ messages }) => useAssistantVoice(messages), {
      initialProps: { messages: [GREETING] },
    })

    rerender({ messages: [GREETING, QUESTION, REPLY] })

    expect(result.current.activeMessageId).toBe(REPLY.id)
    expect(result.current.elapsed).toBe(0)
    expect(result.current.status).toBe('idle')
  })

  it('dùng giọng Mai Anh cho câu trả lời của trợ lý', () => {
    renderHook(() => useAssistantVoice([GREETING]))

    expect(useSpeak).toHaveBeenCalledWith({ voiceId: 'north-female-news' })
  })

  it('không đọc lời chào lúc mở panel', () => {
    // Panel lazy nên lúc mount cử chỉ mở đã hết: trình duyệt sẽ chặn autoplay,
    // và tự phát tiếng khi người dùng chưa hỏi gì cũng là hành vi gây khó chịu.
    renderHook(() => useAssistantVoice([GREETING]))

    expect(voice.speak).not.toHaveBeenCalled()
  })

  it('không đọc tin nhắn do chính người dùng gửi', () => {
    const { rerender } = renderHook(({ messages }) => useAssistantVoice(messages), {
      initialProps: { messages: [GREETING] },
    })

    rerender({ messages: [GREETING, QUESTION] })

    expect(voice.speak).not.toHaveBeenCalled()
  })

  it('mở Web Audio ngay trong cử chỉ gửi, trước khi câu trả lời về', () => {
    const { result } = renderHook(() => useAssistantVoice([GREETING]))

    act(() => result.current.prepare())

    expect(voice.unlock).toHaveBeenCalledTimes(1)
  })

  it('tắt tiếng thì dừng phát, không đọc câu sau và nhớ lựa chọn', () => {
    const { rerender, result } = renderHook(({ messages }) => useAssistantVoice(messages), {
      initialProps: { messages: [GREETING] },
    })

    act(() => result.current.toggle())
    rerender({ messages: [GREETING, QUESTION] })
    rerender({ messages: [GREETING, QUESTION, REPLY] })

    expect(result.current.enabled).toBe(false)
    expect(voice.stop).toHaveBeenCalledTimes(1)
    expect(voice.speak).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('procv_assistant_voice_v1')).toBe('off')
  })

  it('giữ trạng thái tắt tiếng ở lần mở panel sau', () => {
    window.localStorage.setItem('procv_assistant_voice_v1', 'off')

    const { rerender, result } = renderHook(({ messages }) => useAssistantVoice(messages), {
      initialProps: { messages: [GREETING] },
    })
    rerender({ messages: [GREETING, QUESTION, REPLY] })

    expect(result.current.enabled).toBe(false)
    expect(voice.speak).not.toHaveBeenCalled()
  })

  it('bật lại tiếng cũng là một cử chỉ hợp lệ để mở Web Audio', () => {
    window.localStorage.setItem('procv_assistant_voice_v1', 'off')
    const { result } = renderHook(() => useAssistantVoice([GREETING]))

    act(() => result.current.toggle())

    expect(result.current.enabled).toBe(true)
    expect(voice.unlock).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('procv_assistant_voice_v1')).toBe('on')
  })

  it('không đọc lại câu cũ khi người dùng bật tiếng giữa chừng', () => {
    window.localStorage.setItem('procv_assistant_voice_v1', 'off')
    const { rerender, result } = renderHook(({ messages }) => useAssistantVoice(messages), {
      initialProps: { messages: [GREETING] },
    })

    rerender({ messages: [GREETING, QUESTION, REPLY] })
    act(() => result.current.toggle())

    expect(voice.speak).not.toHaveBeenCalled()
  })
})
