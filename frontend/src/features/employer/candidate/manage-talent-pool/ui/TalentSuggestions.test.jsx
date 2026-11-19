import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TalentSuggestions from './TalentSuggestions'

const api = vi.hoisted(() => ({
  getTalentSuggestions: vi.fn(),
  inviteFromTalentPool: vi.fn(),
  getEmployerJobPage: vi.fn(),
}))
vi.mock('@/entities/application/application', async (importOriginal) => ({
  ...(await importOriginal()),
  getTalentSuggestions: api.getTalentSuggestions,
  inviteFromTalentPool: api.inviteFromTalentPool,
}))
vi.mock('@/entities/job/job', async (importOriginal) => ({
  ...(await importOriginal()),
  getEmployerJobPage: api.getEmployerJobPage,
}))

describe('TalentSuggestions', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getEmployerJobPage.mockResolvedValue({ count: 1, results: [{ public_id: 'jb_1', title: 'Backend' }] })
    api.getTalentSuggestions.mockResolvedValue([{
      entry: { public_id: 'tpe_1', candidate_name: 'Nguyễn An', source_job_title: 'Backend cũ' },
      score: 58,
      reasons: ['Cùng vị trí chuyên môn'],
      already_invited: false,
    }])
    api.inviteFromTalentPool.mockResolvedValue()
  })

  it('ranks pool members for the chosen job and invites one', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TalentSuggestions jobPublicId="jb_1" onJobChange={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('58 điểm')).toBeInTheDocument()
    expect(screen.getByText('Cùng vị trí chuyên môn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mời ứng tuyển/ }))

    await waitFor(() => expect(api.inviteFromTalentPool).toHaveBeenCalledWith('tpe_1', 'jb_1'))
  })
})
