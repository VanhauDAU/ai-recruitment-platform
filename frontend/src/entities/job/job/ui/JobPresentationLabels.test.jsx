import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JobPresentationLabels from './JobPresentationLabels'

describe('JobPresentationLabels', () => {
  it('renders the system labels with text, so color is never the only signal', () => {
    render(
      <JobPresentationLabels
        job={{
          presentation: {
            labels: [
              { code: 'closing_soon', text: 'Sắp hết hạn', tone: 'warning' },
              { code: 'fast_response', text: 'Phản hồi nhanh', tone: 'success' },
            ],
          },
        }}
      />,
    )

    expect(screen.getByText('Sắp hết hạn')).toHaveClass('border-amber-200')
    expect(screen.getByText('Phản hồi nhanh')).toHaveAttribute(
      'title',
      expect.stringContaining('phản hồi hồ sơ đúng hạn'),
    )
  })

  it('ignores label codes it does not know, such as retired paid labels', () => {
    const { container } = render(
      <JobPresentationLabels
        job={{ presentation: { labels: [{ code: 'sponsored', text: 'Tài trợ', tone: 'sponsored' }] } }}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
