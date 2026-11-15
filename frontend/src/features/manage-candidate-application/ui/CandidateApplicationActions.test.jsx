import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withdrawCandidateApplication } from '@/entities/application'
import { withQueryClient } from '@/test/render-with-query-client'
import CandidateApplicationActions from './CandidateApplicationActions'

vi.mock('@/entities/application', async (importOriginal) => ({
  ...(await importOriginal()),
  replaceCandidateApplicationCv: vi.fn(),
  withdrawCandidateApplication: vi.fn(),
}))
vi.mock('@/entities/cv', () => ({ getMyCvs: vi.fn().mockResolvedValue([]) }))

const APPLICATION = {
  public_id: 'app_1',
  job_title: 'Kỹ sư Backend',
  cv_public_id: 'cv_1',
  actions: { withdraw: true, update_cv: true, reapply: false },
}

describe('CandidateApplicationActions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers only the actions the application allows', () => {
    const { rerender } = render(withQueryClient(<CandidateApplicationActions application={APPLICATION} />))
    expect(screen.getByRole('button', { name: 'Đổi CV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rút hồ sơ' })).toBeInTheDocument()

    rerender(withQueryClient(
      <CandidateApplicationActions application={{ ...APPLICATION, actions: { withdraw: false, update_cv: false } }} />,
    ))
    expect(screen.queryByRole('button', { name: 'Rút hồ sơ' })).not.toBeInTheDocument()
  })

  it('withdraws only after the candidate confirms', async () => {
    withdrawCandidateApplication.mockResolvedValue({ ...APPLICATION, status: 'withdrawn' })
    const user = userEvent.setup()
    render(withQueryClient(<CandidateApplicationActions application={APPLICATION} />))

    await user.click(screen.getByRole('button', { name: 'Rút hồ sơ' }))
    expect(withdrawCandidateApplication).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Rút hồ sơ' }))

    await waitFor(() => expect(withdrawCandidateApplication).toHaveBeenCalledWith('app_1'))
  })
})
