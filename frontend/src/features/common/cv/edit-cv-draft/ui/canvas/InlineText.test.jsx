import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InlineText from './InlineText'

function placeCaretAtEnd(element) {
  const range = globalThis.document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  const selection = globalThis.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('InlineText', () => {
  it('does not replace focused editable DOM or reset the caret during an unrelated render', () => {
    const onCommit = vi.fn()
    const { rerender } = render(<InlineText value="CV ban đầu" ariaLabel="Tên CV" onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Tên CV' })

    fireEvent.focus(input)
    input.textContent = 'CV đang nhập'
    placeCaretAtEnd(input)
    fireEvent.input(input)
    rerender(<InlineText value="CV ban đầu" ariaLabel="Tên CV" onCommit={onCommit} className="text-slate-800" />)

    expect(input).toHaveTextContent('CV đang nhập')
    expect(globalThis.getSelection().anchorNode === input || input.contains(globalThis.getSelection().anchorNode)).toBe(true)
    expect(globalThis.getSelection().anchorOffset).toBeGreaterThan(0)
  })

  it('accepts an external value after the field loses focus', () => {
    const { rerender } = render(<InlineText value="CV cũ" ariaLabel="Tên CV" onCommit={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Tên CV' })

    fireEvent.focus(input)
    fireEvent.blur(input)
    rerender(<InlineText value="CV mới" ariaLabel="Tên CV" onCommit={vi.fn()} />)

    expect(input).toHaveTextContent('CV mới')
  })

  it('exposes a formatting toolbar and commits field-level marks', () => {
    const onMarksChange = vi.fn()
    render(<InlineText value="Bằng cấp" ariaLabel="Bằng cấp" onCommit={vi.fn()} onMarksChange={onMarksChange} />)
    const input = screen.getByRole('textbox', { name: 'Bằng cấp' })

    fireEvent.focus(input)
    fireEvent.click(screen.getByRole('button', { name: 'In đậm văn bản' }))

    expect(screen.getByRole('toolbar', { name: 'Thao tác văn bản ngắn' })).toHaveClass('fixed')
    expect(onMarksChange).toHaveBeenCalledWith({ bold: true })
  })
})
