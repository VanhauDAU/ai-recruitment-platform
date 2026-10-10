import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RichTextImageLibrary from './RichTextImageLibrary'

describe('RichTextImageLibrary', () => {
  it('inserts an HTTPS image directly when the domain enables external images', () => {
    const onInsert = vi.fn()
    const onCancel = vi.fn()
    render(
      <RichTextImageLibrary
        open
        allowExternalImage
        onCancel={onCancel}
        onInsert={onInsert}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /Từ URL/i }))
    fireEvent.change(screen.getByLabelText('URL hình ảnh'), {
      target: { value: 'https://cdn.example.com/help/step.webp' },
    })
    fireEvent.change(screen.getByLabelText('Mô tả ảnh từ URL'), {
      target: { value: 'Các bước cập nhật hồ sơ' },
    })

    const insertButton = screen.getByRole('button', { name: 'Chèn vào bài viết' })
    expect(insertButton).toBeEnabled()
    fireEvent.click(insertButton)
    expect(onInsert).toHaveBeenCalledWith({
      src: 'https://cdn.example.com/help/step.webp',
      alt: 'Các bước cập nhật hồ sơ',
    })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not allow an insecure image URL', () => {
    render(
      <RichTextImageLibrary
        open
        allowExternalImage
        onCancel={vi.fn()}
        onInsert={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /Từ URL/i }))
    fireEvent.change(screen.getByLabelText('URL hình ảnh'), {
      target: { value: 'http://cdn.example.com/help/step.webp' },
    })
    fireEvent.change(screen.getByLabelText('Mô tả ảnh từ URL'), {
      target: { value: 'Ảnh không an toàn' },
    })

    expect(screen.getByText(/Nhập URL HTTPS/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chèn vào bài viết' })).toBeDisabled()
  })
})
