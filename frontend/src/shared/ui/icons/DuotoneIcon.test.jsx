import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DuotoneIcon from './DuotoneIcon'

describe('DuotoneIcon', () => {
  it('draws the tinted layer under the outline and hides itself unless titled', () => {
    const { container } = render(<DuotoneIcon name="bellRinging" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelectorAll('path')).toHaveLength(2)
    expect(svg.querySelector('path')).toHaveAttribute('opacity', '0.2')

    render(<DuotoneIcon name="unknown-icon" title="Thông tin" />)
    expect(screen.getByRole('img', { name: 'Thông tin' })).toBeInTheDocument()
  })
})
