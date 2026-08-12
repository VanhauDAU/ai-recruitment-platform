import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JobPresentationLabels from './JobPresentationLabels'

describe('JobPresentationLabels', () => {
  it('renders semantic text so color is never the only signal', () => {
    render(
      <JobPresentationLabels
        job={{
          presentation: {
            display_reason: 'Tin được tài trợ bởi nhà tuyển dụng.',
            labels: [
              { code: 'sponsored', text: 'Tài trợ', tone: 'sponsored' },
              { code: 'urgent', text: 'GẤP', tone: 'warning' },
              { code: 'fast_response', text: 'Phản hồi nhanh', tone: 'success' },
            ],
          },
        }}
      />,
    )

    expect(screen.getByText('Tài trợ')).toHaveAttribute(
      'title',
      'Tin được tài trợ bởi nhà tuyển dụng.',
    )
    expect(screen.getByText('GẤP')).toBeVisible()
    expect(screen.getByText('Phản hồi nhanh')).toBeVisible()
  })
})
