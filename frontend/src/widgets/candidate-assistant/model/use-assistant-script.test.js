import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findAssistantReply, useAssistantScript } from './use-assistant-script'

describe('assistant script', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('so khớp tiếng Việt không dấu và có fallback', () => {
    expect(findAssistantReply('Tôi muốn tạo CV đẹp').id).toBe('create-cv')
    expect(findAssistantReply('một câu không thuộc kịch bản').id).toBe('fallback')
  })

  it('thêm tin nhắn và trả lời sau thời gian typing', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAssistantScript())

    act(() => result.current.sendMessage('Cách ứng tuyển?'))
    expect(result.current.typing).toBe(true)
    expect(result.current.messages.at(-1)).toMatchObject({ from: 'user', text: 'Cách ứng tuyển?' })

    act(() => vi.runAllTimers())
    expect(result.current.typing).toBe(false)
    expect(result.current.emotion).toBe('happy')
    expect(result.current.messages.at(-1)).toMatchObject({ from: 'assistant' })
  })
})

