import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AdminJobDisclosure from './AdminJobDisclosure'

describe('AdminJobDisclosure', () => {
  it('exposes its state and only mounts sensitive content while open', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <AdminJobDisclosure
        description="Ẩn mặc định vì chứa dữ liệu nhạy cảm"
        onToggle={onToggle}
        open={false}
        sectionKey="contact"
        title="Thông tin nhận hồ sơ"
      >
        <span>0901234567</span>
      </AdminJobDisclosure>,
    )

    const trigger = screen.getByRole('button', { name: /Thông tin nhận hồ sơ/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('0901234567')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    expect(onToggle).toHaveBeenCalledWith('contact')

    rerender(
      <AdminJobDisclosure
        description="Ẩn mặc định vì chứa dữ liệu nhạy cảm"
        onToggle={onToggle}
        open
        sectionKey="contact"
        title="Thông tin nhận hồ sơ"
      >
        <span>0901234567</span>
      </AdminJobDisclosure>,
    )

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('0901234567')).toBeVisible()
  })
})
