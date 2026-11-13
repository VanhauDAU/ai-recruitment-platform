import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import JobDetailSidebar from './JobDetailSidebar'

const JOB = {
  company_name: 'Công ty Alpha & Partners',
  company_industries: [],
  domain_knowledge: [],
}

function renderSidebar(job) {
  return render(
    <MemoryRouter>
      <JobDetailSidebar job={job} />
    </MemoryRouter>,
  )
}

describe('JobDetailSidebar company destination', () => {
  it('keeps an official company website external and labels it clearly', () => {
    renderSidebar({ ...JOB, company_website_url: 'https://company.example/about' })

    const link = screen.getByRole('link', { name: /Website công ty/ })
    expect(link).toHaveAttribute('href', 'https://company.example/about')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('falls back to the filtered public company directory without a website', () => {
    renderSidebar(JOB)

    expect(screen.getByRole('link', { name: /Xem trang công ty/ }))
      .toHaveAttribute(
        'href',
        '/cong-ty/tim-kiem?keyword=C%C3%B4ng+ty+Alpha+%26+Partners',
      )
  })
})
