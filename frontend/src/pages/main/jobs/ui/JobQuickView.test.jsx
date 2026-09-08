import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobQuickView from './JobQuickView'

const mocks = vi.hoisted(() => ({
  getJobDetail: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('react-router', async (importOriginal) => ({
  ...await importOriginal(),
  useNavigate: () => mocks.navigate,
}))

vi.mock('@/entities/job', async (importOriginal) => ({
  ...await importOriginal(),
  getJobDetail: mocks.getJobDetail,
}))

vi.mock('@/features/compare-jobs', () => ({
  JobCompareButton: () => null,
}))

vi.mock('@/features/saved-jobs', () => ({
  SavedJobTooltipContent: () => null,
  useSavedJob: () => [false, vi.fn(), false],
}))

vi.mock('@/features/track-job-engagement', () => ({
  useJobView: vi.fn(),
}))

const JOB = {
  public_id: 'job_alpha',
  slug: 'frontend-engineer',
  title: 'Frontend Engineer',
  company_name: 'Công ty Alpha & Partners',
  comparison_enabled: false,
  salary_type: 'negotiable',
}

describe('JobQuickView company destination', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.getJobDetail.mockResolvedValue(JOB)
    mocks.navigate.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the filtered public company directory', async () => {
    render(
      <MemoryRouter>
        <JobQuickView job={JOB} onClose={vi.fn()} />
      </MemoryRouter>,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    fireEvent.click(screen.getByRole('button', { name: /Xem trang công ty/ }))

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/cong-ty/tim-kiem?keyword=C%C3%B4ng+ty+Alpha+%26+Partners',
    )
  })
})
