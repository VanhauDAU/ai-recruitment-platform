import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JobCard from './JobCard'

vi.mock('@/features/saved-jobs', () => ({
  useSavedJob: () => [false, vi.fn(), false],
}))

vi.mock('@/features/track-job-engagement', () => ({
  useJobImpression: () => vi.fn(),
}))

describe('JobCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the job title black instead of inheriting the brand link color', () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            public_id: 'job-1',
            slug: 'frontend-engineer-job-1',
            title: 'Frontend Engineer',
            company_name: 'ProCV',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Frontend Engineer' })).toHaveClass(
      '!text-slate-950',
      'hover:!text-slate-950',
    )
  })

  it('keeps the original posted date when a job is approved again', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-13T08:00:00Z').getTime())

    render(
      <MemoryRouter>
        <JobCard
          job={{
            public_id: 'job-2',
            slug: 'backend-engineer-job-2',
            title: 'Backend Engineer',
            company_name: 'ProCV',
            first_approved_at: '2026-08-11T08:00:00Z',
            published_at: '2026-08-13T08:00:00Z',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Đăng 2 ngày trước')).toBeVisible()
    expect(screen.queryByText('Đăng hôm nay')).not.toBeInTheDocument()
  })

  it('shows the candidate recommendation label without replacing sponsored disclosure', () => {
    render(
      <MemoryRouter>
        <JobCard
          recommendationLabel="Đề xuất cho bạn"
          job={{
            public_id: 'job-3',
            slug: 'sponsored-recommendation-job-3',
            title: 'Product Engineer',
            company_name: 'ProCV',
            tier: 'top',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Đề xuất cho bạn')).toBeVisible()
    expect(screen.getByText('Tài trợ')).toBeVisible()
  })
})
