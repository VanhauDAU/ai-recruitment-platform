import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MascotEmpty from './MascotEmpty'

describe('MascotEmpty', () => {
  it('render scene trang trí cùng nội dung có nghĩa', () => {
    const { container } = render(
      <MascotEmpty scene="searchJob" description="Bạn chưa lưu việc làm nào">
        <button type="button">Khám phá việc làm</button>
      </MascotEmpty>,
    )

    expect(container.querySelector('img')).toHaveAttribute('src', expect.stringContaining('robot-search-job.webp'))
    expect(screen.getByText('Bạn chưa lưu việc làm nào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Khám phá việc làm' })).toBeInTheDocument()
  })
})
