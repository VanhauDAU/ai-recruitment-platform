import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyTalentPools from './MyTalentPools'

const api = vi.hoisted(() => ({ getMyTalentPools: vi.fn(), withdrawFromTalentPool: vi.fn() }))
vi.mock('@/entities/application/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

describe('MyTalentPools', () => {
  beforeEach(() => {
    api.getMyTalentPools.mockReset().mockResolvedValue([{
      public_id: 'tpe_1', company_name: 'Pool Co', source_job_title: 'Backend',
      created_at: '2026-11-15T09:00:00+07:00', expires_at: '2027-11-15T09:00:00+07:00',
    }])
    api.withdrawFromTalentPool.mockReset().mockResolvedValue()
  })

  it('lets the candidate withdraw after confirmation', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MyTalentPools />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Pool Co')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rút hồ sơ' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rút hồ sơ' }))

    await waitFor(() => expect(api.withdrawFromTalentPool).toHaveBeenCalledWith('tpe_1'))
  })
})
