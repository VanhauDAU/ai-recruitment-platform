import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BlockCandidateButton from './BlockCandidateButton'

const api = vi.hoisted(() => ({ blockCandidate: vi.fn() }))
vi.mock('@/entities/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

describe('BlockCandidateButton', () => {
  beforeEach(() => api.blockCandidate.mockReset().mockResolvedValue({ public_id: 'cbk_1' }))

  it('blocks with reason, duration and the reject-pending option', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BlockCandidateButton application={{ public_id: 'app_1' }} candidateName="Nguyễn An" />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: /Chặn ứng viên/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByLabelText('Hồ sơ giả mạo'))
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(within(dialog).getByRole('button', { name: /Chặn ứng viên/ }))

    await waitFor(() => expect(api.blockCandidate).toHaveBeenCalledWith({
      application_public_id: 'app_1',
      reason: 'fake_profile',
      note: '',
      duration_days: 90,
      reject_pending: true,
    }))
  })
})
