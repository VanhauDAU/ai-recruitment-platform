import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobQualityRating from './JobQualityRating'

vi.mock('@/shared/lib/toast', () => ({ message: { success: vi.fn() } }))

describe('JobQualityRating', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('shows the thank-you acknowledgement only immediately after submitting', () => {
    const view = render(<JobQualityRating jobId="job_rating_once" />)

    fireEvent.click(screen.getByRole('button', { name: /Rất đáng tin cậy & rõ ràng/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))

    expect(screen.getByRole('heading', { name: 'Cảm ơn bạn đã đánh giá' })).toBeInTheDocument()

    view.unmount()
    render(<JobQualityRating jobId="job_rating_once" />)

    expect(screen.queryByRole('heading', { name: 'Cảm ơn bạn đã đánh giá' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Đánh giá tin tuyển dụng' })).not.toBeInTheDocument()
  })
})
