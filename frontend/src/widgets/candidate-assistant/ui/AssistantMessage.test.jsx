import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AssistantMessage from './AssistantMessage'

describe('AssistantMessage', () => {
  it('exposes click-to-listen only for an available assistant surface', async () => {
    const onToggle = vi.fn()
    render(
      <AssistantMessage
        from="assistant"
        progressive
        speech={{
          active: false,
          available: true,
          onToggle,
          speaking: false,
          status: 'idle',
        }}
        text="Câu trả lời của trợ lý."
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Nghe tin nhắn' }))

    expect(onToggle).toHaveBeenCalledOnce()
  })
})
