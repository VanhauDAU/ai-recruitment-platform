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
        applicationStatus={{ hasApplied: false, isLimitReached: false, applyLabel: 'Ứng tuyển ngay' }}
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

  it('replaces the apply button once the employer stopped recruiting', () => {
    renderHero({ ...JOB, accepting_applications: false })

    expect(screen.queryByRole('button', { name: /Ứng tuyển ngay/ })).not.toBeInTheDocument()
    expect(screen.getByText('Hết hạn ứng tuyển')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem việc làm liên quan' })).toBeVisible()
  })

  it('shows salary with its note and the three key facts', () => {
    renderHero({ ...JOB, deadline: '2099-12-29' })

    expect(screen.getByLabelText('Mức lương: 15 - 20 triệu, Khi đạt 100% KPI')).toBeVisible()
    expect(screen.getByText('Địa điểm').nextElementSibling).toHaveTextContent('Thành phố Đà Nẵng')
    expect(screen.getByText('Kinh nghiệm').nextElementSibling).toHaveTextContent('2 năm')
    expect(screen.getByText('Hạn ứng tuyển').nextElementSibling).toHaveTextContent('29/12/2099')
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
