import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { richTextV2 } from '@/entities/cv'
import RichTextArea from './RichTextArea'

function selectText(root, start, end) {
  const text = root.querySelector('span').firstChild
  const range = globalThis.document.createRange()
  range.setStart(text, start)
  range.setEnd(text, end)
  const selection = globalThis.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('RichTextArea', () => {
  it('shows the active font and size in a floating toolbar without taking A4 layout space', () => {
    render(<RichTextArea value={{
      format: 'rich_text_v2',
      content: [{ type: 'paragraph', text: 'CV', runs: [{ text: 'CV', marks: { font_family: 'Inter', font_size_pt: 14, color: '#2255AA' } }] }],
    }} ariaLabel="Mô tả" onCommit={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Mô tả' })

    fireEvent.focus(input)
    selectText(input, 0, 2)
    fireEvent.mouseUp(input)

    expect(screen.getByRole('toolbar', { name: 'Định dạng văn bản' })).toHaveClass('fixed')
    expect(screen.getByText('Inter')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Cỡ chữ vùng chọn' })).toHaveValue('14')
  })

  it('formats the selected text once and retains the selection instead of duplicating editable content', () => {
    const onCommit = vi.fn()
    render(<RichTextArea value={richTextV2('abcdef')} ariaLabel="Mô tả" onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Mô tả' })

    fireEvent.focus(input)
    selectText(input, 1, 4)
    fireEvent.mouseUp(input)
    fireEvent.click(screen.getByRole('button', { name: 'In đậm' }))

    expect(input).toHaveTextContent('abcdef')
    expect(input.querySelectorAll('span')).toHaveLength(3)
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({
      content: [expect.objectContaining({ runs: [
        expect.objectContaining({ text: 'a' }),
        expect.objectContaining({ text: 'bcd', marks: { bold: true } }),
        expect.objectContaining({ text: 'ef' }),
      ] })],
    }))
  })

  it('keeps the last highlighted range when the toolbar click collapses the browser selection', () => {
    const onCommit = vi.fn()
    render(<RichTextArea value={richTextV2('abcdef')} ariaLabel="Mô tả" onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Mô tả' })

    fireEvent.focus(input)
    selectText(input, 1, 4)
    fireEvent.mouseUp(input)
    globalThis.getSelection().collapseToEnd()
    fireEvent.click(screen.getByRole('button', { name: 'In đậm' }))

    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({
      content: [expect.objectContaining({ runs: expect.arrayContaining([
        expect.objectContaining({ text: 'bcd', marks: { bold: true } }),
      ]) })],
    }))
  })
})
