import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssistantMessage from './AssistantMessage'

describe('AssistantMessage', () => {
  afterEach(() => vi.useRealTimers())

  it('yêu cầu cuộn xuống theo từng nhịp typewriter', () => {
    vi.useFakeTimers()
    const onContentProgress = vi.fn()
    render(
      <AssistantMessage
        from="assistant"
        onAction={vi.fn()}
        onContentProgress={onContentProgress}
        progressive
        speech={{ active: true, enabled: false, status: 'idle' }}
        text="Câu trả lời đang được đánh máy."
      />,
    )
    const callsAfterMount = onContentProgress.mock.calls.length

    act(() => vi.advanceTimersByTime(120))

    expect(onContentProgress.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })
})
