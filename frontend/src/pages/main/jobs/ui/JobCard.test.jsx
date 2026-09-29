import { fireEvent, render, screen } from '@testing-library/react'
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

  it('keeps the always-visible comparison action from opening quick view', () => {
    const onQuickView = vi.fn()
    render(
      <MemoryRouter>
        <JobCard
          onQuickView={onQuickView}
          job={{
            public_id: 'job-4',
            slug: 'quality-engineer-job-4',
            title: 'Quality Engineer',
            company_name: 'ProCV',
          }}
        />
      </MemoryRouter>,
    )

    const compareButton = screen.getByRole('button', { name: 'Thêm Quality Engineer vào so sánh' })
    expect(compareButton).toHaveAttribute('aria-pressed', 'false')
    expect(compareButton).toHaveClass('w-11', 'gap-0', 'hover:w-[7.25rem]', 'hover:gap-2')
    expect(compareButton.querySelector('.anticon')).toHaveClass('shrink-0')
    expect(screen.getByText('So sánh')).toHaveClass(
      'min-w-0',
      'max-w-0',
      'overflow-hidden',
      'group-hover/compare:max-w-20',
    )
    fireEvent.click(compareButton)
    expect(onQuickView).not.toHaveBeenCalled()
  })
})
