import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JobRichContent from './JobRichContent'

describe('JobRichContent', () => {
  it('sanitizes unsafe HTML while retaining candidate-facing content', () => {
    const { container } = render(
      <JobRichContent html={'<p>Thông tin tuyển dụng</p><script>alert(1)</script><a href="javascript:alert(2)">Xem</a>'} />,
    )

    expect(screen.getByText('Thông tin tuyển dụng')).toBeVisible()
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('Xem')).not.toHaveAttribute('href', expect.stringContaining('javascript:'))
  })
})
