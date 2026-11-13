import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CvTemplatePreview from './CvTemplatePreview'

describe('CvTemplatePreview', () => {
  it('replaces a thumbnail that fails to load with the drawn preview instead of a broken image', () => {
    render(<CvTemplatePreview template={{ display_name: 'Thanh Lịch' }} imageUrl="https://cdn.example/old-thumbnail.png" />)

    fireEvent.error(screen.getByRole('img', { name: 'Xem trước Thanh Lịch' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Xem trước Thanh Lịch')).toBeInTheDocument()
  })
})
