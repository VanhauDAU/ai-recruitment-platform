import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRecruiterVisibility, updateRecruiterVisibility } from '@/entities/candidate-preferences'
import { getMyCvs, setCvRecruiterSearchable } from '@/entities/cv'
import RecruiterSearchListModal from './RecruiterSearchListModal'

vi.mock('@/entities/candidate-preferences', () => ({
  RECRUITER_VISIBILITY_QUERY_KEY: ['candidate', 'recruiter-visibility'],
  getRecruiterVisibility: vi.fn(),
  updateRecruiterVisibility: vi.fn(),
}))
vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  getMyCvs: vi.fn(),
  setCvRecruiterSearchable: vi.fn(),
}))

const cvs = [
  { public_id: 'cv_1', title: 'CV online A', cv_type: 'builder', recruiter_searchable: false, updated_at: '2026-11-15T08:00:00Z' },
  { public_id: 'cv_2', title: 'cv.pdf', cv_type: 'uploaded', recruiter_searchable: false, updated_at: '2026-11-15T09:00:00Z' },
]

function renderModal(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RecruiterSearchListModal open onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return onClose
}

describe('RecruiterSearchListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMyCvs.mockResolvedValue(cvs)
    getRecruiterVisibility.mockResolvedValue({ enabled: false, policy_version: 'v1' })
    updateRecruiterVisibility.mockResolvedValue({ enabled: true, policy_version: 'v1' })
    setCvRecruiterSearchable.mockResolvedValue({})
  })

  it('lists every CV type and saves consent before the changed CVs only', async () => {
    const onClose = renderModal()

    expect(await screen.findByRole('link', { name: 'CV online A' })).toHaveAttribute('href', '/cvs/cv_1/view')
    expect(screen.getByText(/CV tải lên/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'Cho phép NTD tìm kiếm CV online A' }))

    const save = screen.getByRole('button', { name: 'Lưu' })
    expect(save).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tôi đồng ý cho phép NTD tìm kiếm hồ sơ của tôi' }))
    await userEvent.click(save)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateRecruiterVisibility).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
    expect(setCvRecruiterSearchable).toHaveBeenCalledTimes(1)
    expect(setCvRecruiterSearchable).toHaveBeenCalledWith('cv_1', true)
  })
})
