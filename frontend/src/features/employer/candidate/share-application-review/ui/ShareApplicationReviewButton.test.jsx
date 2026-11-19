import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShareApplicationReviewButton from './ShareApplicationReviewButton'

const api = vi.hoisted(() => ({
  getApplicationReviewLinks: vi.fn(),
  createApplicationReviewLink: vi.fn(),
  revokeApplicationReviewLink: vi.fn(),
}))
vi.mock('@/entities/application/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

const ACTIVE = {
  public_id: 'arl_1', reviewer_name: 'Anh Minh', message: '', status: 'active', has_review: false,
  expires_at: '2026-12-01T10:00:00+07:00', open_count: 2,
}

function renderButton() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ShareApplicationReviewButton publicId="app_1" candidateName="Nguyễn An" jobTitle="Kỹ sư Data" />
    </QueryClientProvider>,
  )
}

describe('ShareApplicationReviewButton', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getApplicationReviewLinks.mockResolvedValue([ACTIVE])
  })

  it('creates a link, shows it once with copy and email actions', async () => {
    const user = userEvent.setup()
    api.createApplicationReviewLink.mockResolvedValue({
      link: { ...ACTIVE, public_id: 'arl_2', reviewer_name: 'Chị Lan' },
      url: 'http://localhost:5173/tuyendung/danh-gia-ho-so/tok',
    })
    renderButton()

    await user.click(screen.getByRole('button', { name: /Mời đánh giá/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Người nhận'), 'Chị Lan')
    await user.click(within(dialog).getByRole('button', { name: 'Tạo link' }))

    await waitFor(() => expect(api.createApplicationReviewLink).toHaveBeenCalledWith(
      'app_1', expect.objectContaining({ reviewer_name: 'Chị Lan', expires_in_days: 7 }),
    ))
    expect(await within(dialog).findByDisplayValue('http://localhost:5173/tuyendung/danh-gia-ho-so/tok')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Gửi qua email/ }).getAttribute('href')).toMatch(/^mailto:\?subject=/)
  })

  it('revokes an active link after confirmation', async () => {
    const user = userEvent.setup()
    api.revokeApplicationReviewLink.mockResolvedValue({ ...ACTIVE, status: 'revoked' })
    renderButton()

    await user.click(screen.getByRole('button', { name: /Mời đánh giá/ }))
    await user.click(await screen.findByRole('button', { name: 'Thu hồi' }))
    const confirm = await screen.findByText('Thu hồi link đánh giá')
    await user.click(within(confirm.closest('.ant-modal')).getByRole('button', { name: 'Thu hồi' }))

    await waitFor(() => expect(api.revokeApplicationReviewLink).toHaveBeenCalledWith('app_1', 'arl_1'))
  })
})
