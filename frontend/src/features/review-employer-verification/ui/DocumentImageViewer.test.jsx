import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DocumentImageViewer from './DocumentImageViewer'

describe('DocumentImageViewer', () => {
  it('zooms, resets and fits the document with accessible controls', async () => {
    const user = userEvent.setup()
    render(
      <DocumentImageViewer
        src="blob:http://localhost/document"
        alt="Giấy đăng ký doanh nghiệp"
        contentType="image/jpeg"
        onError={vi.fn()}
      />,
    )

    expect(screen.getByText('Vừa khung', { selector: '.verification-image-zoom-value' }))
      .toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Phóng to giấy tờ' }))
    expect(screen.getByText('125%', { selector: '.verification-image-zoom-value' }))
      .toBeInTheDocument()

    await user.click(screen.getByRole('button', {
      name: 'Hiển thị giấy tờ ở mức 100 phần trăm',
    }))
    expect(screen.getByText('100%', { selector: '.verification-image-zoom-value' }))
      .toBeInTheDocument()

    await user.click(screen.getByRole('button', {
      name: 'Đưa toàn bộ giấy tờ vừa khung xem',
    }))
    expect(screen.getByText('Vừa khung', { selector: '.verification-image-zoom-value' }))
      .toBeInTheDocument()
  })

  it('supports keyboard zoom shortcuts from the document canvas', async () => {
    const user = userEvent.setup()
    render(
      <DocumentImageViewer
        src="blob:http://localhost/document"
        alt="Giấy ủy quyền"
        contentType="image/png"
        onError={vi.fn()}
      />,
    )

    const canvas = screen.getByRole('region', { name: /Vùng xem Giấy ủy quyền/ })
    canvas.focus()
    await user.keyboard('+')
    expect(screen.getByText('125%', { selector: '.verification-image-zoom-value' }))
      .toBeInTheDocument()

    await user.keyboard('-')
    expect(screen.getByText('100%', { selector: '.verification-image-zoom-value' }))
      .toBeInTheDocument()
  })
})
