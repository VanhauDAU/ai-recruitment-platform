import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JobHero } from './JobDetailOverview'

const JOB = {
  title: 'Kỹ sư Fullstack Java Developer',
  company_name: 'FPT Software',
  salary_type: 'range',
  salary_min: 15_000_000,
  salary_max: 20_000_000,
  income_display_type: 'income_at_kpi',
  experience_years: 2,
  locations_detail: [{ name: 'Thành phố Đà Nẵng' }],
  view_count: 6,
}

function renderHero(job = JOB) {
  return render(
    <MemoryRouter>
      <JobHero
        job={job}
        saved={false}
        applicationStatus={{ hasApplied: false, isLimitReached: false }}
        onApply={vi.fn()}
        onSave={vi.fn()}
        onShare={vi.fn()}
        savePending={false}
      />
    </MemoryRouter>,
  )
}

describe('JobHero', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('promotes salary as the primary hero metric', () => {
    renderHero()

    const salary = screen.getByRole('group', { name: 'Mức lương: 15 - 20 triệu, Khi đạt 100% KPI' })

    expect(salary).toHaveClass('bg-gradient-to-br', 'border-emerald-200')
    expect(screen.getByText('15 - 20 triệu')).toHaveClass('text-xl', 'font-extrabold')
    expect(screen.getByText('Khi đạt 100% KPI')).toHaveClass('text-xs', 'text-emerald-700')
    expect(screen.getByRole('group', { name: /Địa điểm: Thành phố Đà Nẵng/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Kinh nghiệm: 2 năm' })).toBeInTheDocument()
  })

  it('shows the first approval date after a job is approved again', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-13T08:00:00Z').getTime())

    renderHero({
      ...JOB,
      first_approved_at: '2026-08-11T08:00:00Z',
      published_at: '2026-08-13T08:00:00Z',
    })

    expect(screen.getByText('Đăng 2 ngày trước')).toBeVisible()
    expect(screen.queryByText('Đăng hôm nay')).not.toBeInTheDocument()
  })
})
