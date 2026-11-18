import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RichContent from './RichContent'

describe('RichContent', () => {
  it('sanitizes unsafe HTML while retaining readable content', () => {
    const { container } = render(
      <RichContent html={'<p>Thông tin tuyển dụng</p><script>alert(1)</script><a href="javascript:alert(2)">Xem</a>'} />,
    )

    expect(screen.getByText('Thông tin tuyển dụng')).toBeVisible()
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('Xem')).not.toHaveAttribute('href', expect.stringContaining('javascript:'))
  })
})
