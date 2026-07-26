import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { JobHero } from './JobDetailOverview'

const JOB = {
  title: 'Kỹ sư Fullstack Java Developer',
  company_name: 'FPT Software',
  salary_type: 'range',
  salary_min: 15_000_000,
  salary_max: 20_000_000,
  experience_years: 2,
  locations_detail: [{ name: 'Thành phố Đà Nẵng' }],
  view_count: 6,
}

function renderHero() {
  return render(
    <MemoryRouter>
      <JobHero
        job={JOB}
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
  it('promotes salary as the primary hero metric', () => {
    renderHero()

    const salary = screen.getByRole('group', { name: 'Mức lương: 15 - 20 triệu' })

    expect(salary).toHaveClass('bg-gradient-to-br', 'border-emerald-200')
    expect(screen.getByText('15 - 20 triệu')).toHaveClass('text-xl', 'font-extrabold')
    expect(screen.getByRole('group', { name: /Địa điểm: Thành phố Đà Nẵng/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Kinh nghiệm: 2 năm' })).toBeInTheDocument()
  })
})
