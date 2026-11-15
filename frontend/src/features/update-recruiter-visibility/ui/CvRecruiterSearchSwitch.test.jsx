import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRecruiterVisibility, updateRecruiterVisibility } from '@/entities/candidate-preferences'
import { setCvRecruiterSearchable } from '@/entities/cv'
import CvRecruiterSearchSwitch from './CvRecruiterSearchSwitch'

vi.mock('@/entities/candidate-preferences', () => ({
  RECRUITER_VISIBILITY_QUERY_KEY: ['candidate', 'recruiter-visibility'],
  getRecruiterVisibility: vi.fn(),
  updateRecruiterVisibility: vi.fn(),
}))
vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  setCvRecruiterSearchable: vi.fn(),
}))

function renderSwitch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CvRecruiterSearchSwitch cv={{ public_id: 'cv_1', recruiter_searchable: false }} />
    </QueryClientProvider>,
  )
}

describe('CvRecruiterSearchSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCvRecruiterSearchable.mockResolvedValue({ recruiter_searchable: true })
  })

  it('asks for profile consent the first time before opening the CV to recruiters', async () => {
    getRecruiterVisibility.mockResolvedValue({ enabled: false, policy_version: 'v1' })
    updateRecruiterVisibility.mockResolvedValue({ enabled: true, policy_version: 'v1' })
    renderSwitch()

    const toggle = await screen.findByRole('switch')
    await waitFor(() => expect(toggle).not.toHaveClass('ant-switch-loading'))
    await userEvent.click(toggle)
    expect(setCvRecruiterSearchable).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận cho phép' }))

    await waitFor(() => expect(setCvRecruiterSearchable).toHaveBeenCalledWith('cv_1', true))
    expect(updateRecruiterVisibility).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, cv_public_id: 'cv_1' }))
    expect(toggle).toBeChecked()
  })

  it('toggles directly once the profile consent exists', async () => {
    getRecruiterVisibility.mockResolvedValue({ enabled: true, policy_version: 'v1' })
    renderSwitch()

    const toggle = await screen.findByRole('switch')
    await waitFor(() => expect(toggle).not.toHaveClass('ant-switch-loading'))
    await userEvent.click(toggle)

    await waitFor(() => expect(setCvRecruiterSearchable).toHaveBeenCalledWith('cv_1', true))
    expect(updateRecruiterVisibility).not.toHaveBeenCalled()
  })
})
