import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { remindRecruiterOfApplication, withdrawCandidateApplication } from '@/entities/application/application'
import { withQueryClient } from '@/test/render-with-query-client'
import CandidateApplicationActions from './CandidateApplicationActions'

vi.mock('@/entities/application/application', async (importOriginal) => ({
  ...(await importOriginal()),
  remindRecruiterOfApplication: vi.fn(),
  withdrawCandidateApplication: vi.fn(),
}))

const APPLICATION = {
  public_id: 'app_1',
  job_title: 'Kỹ sư Backend',
  cv_public_id: 'cv_1',
  actions: { withdraw: true, reapply: false },
}

describe('CandidateApplicationActions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers only the actions the application allows', () => {
    const { rerender } = render(withQueryClient(<CandidateApplicationActions application={APPLICATION} />))
    expect(screen.getByRole('button', { name: 'Rút CV' })).toBeInTheDocument()

    rerender(withQueryClient(
      <CandidateApplicationActions application={{ ...APPLICATION, actions: { withdraw: false } }} />,
    ))
    expect(screen.queryByRole('button', { name: 'Rút CV' })).not.toBeInTheDocument()
  })

  it('withdraws only after the candidate confirms', async () => {
    withdrawCandidateApplication.mockResolvedValue({ ...APPLICATION, status: 'withdrawn' })
    const user = userEvent.setup()
    render(withQueryClient(<CandidateApplicationActions application={APPLICATION} />))

    await user.click(screen.getByRole('button', { name: 'Rút CV' }))
    expect(withdrawCandidateApplication).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Rút CV' }))

    await waitFor(() => expect(withdrawCandidateApplication).toHaveBeenCalledWith('app_1'))
  })

  it('reminds the recruiter when allowed and says when it will be allowed otherwise', async () => {
    remindRecruiterOfApplication.mockResolvedValue({ ...APPLICATION, actions: { remind: false } })
    const user = userEvent.setup()
    const { rerender } = render(withQueryClient(
      <CandidateApplicationActions application={{ ...APPLICATION, actions: { remind: true } }} />,
    ))

    await user.click(screen.getByRole('button', { name: 'Nhắc NTD' }))
    await waitFor(() => expect(remindRecruiterOfApplication).toHaveBeenCalledWith('app_1'))

    rerender(withQueryClient(
      <CandidateApplicationActions
        application={{ ...APPLICATION, actions: { remind: false, remind_available_at: '2026-11-20T02:00:00Z' } }}
      />,
    ))
    expect(screen.getByRole('button', { name: 'Nhắc NTD' })).toBeDisabled()
  })
})
