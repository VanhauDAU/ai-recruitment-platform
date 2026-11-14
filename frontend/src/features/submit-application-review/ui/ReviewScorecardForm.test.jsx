import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewScorecardForm from './ReviewScorecardForm'

const api = vi.hoisted(() => ({ submitPublicApplicationReview: vi.fn() }))
vi.mock('@/entities/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

function renderForm(review = null) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ReviewScorecardForm token="tok" review={review} />
    </QueryClientProvider>,
  )
}

describe('ReviewScorecardForm', () => {
  beforeEach(() => api.submitPublicApplicationReview.mockReset())

  it('requires a recommendation and submits the scorecard', async () => {
    const user = userEvent.setup()
    api.submitPublicApplicationReview.mockResolvedValue({ recommendation: 'yes' })
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))
    expect(await screen.findByText('Chọn một đề xuất.')).toBeInTheDocument()

    await user.click(screen.getByText('Nên tuyển'))
    await user.type(screen.getByLabelText('Điểm mạnh'), 'SQL tốt')
    await user.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))

    await waitFor(() => expect(api.submitPublicApplicationReview).toHaveBeenCalledWith('tok', {
      recommendation: 'yes', rating: null, strengths: 'SQL tốt', concerns: '',
    }))
  })

  it('lets a reviewer update an earlier scorecard', () => {
    renderForm({ recommendation: 'no', rating: 2, strengths: '', concerns: 'Thiếu kinh nghiệm', updated_at: '2026-11-15T09:00:00Z' })

    expect(screen.getByText('Bạn đã gửi đánh giá')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cập nhật đánh giá' })).toBeInTheDocument()
  })
})
