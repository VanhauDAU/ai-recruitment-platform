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
  it('always opens the company page and keeps the official website as a secondary link', () => {
    renderSidebar({
      ...JOB,
      company_slug: 'alpha-partners',
      company_website_url: 'https://company.example/about',
    })

    expect(screen.getByRole('link', { name: /Xem trang công ty/ }))
      .toHaveAttribute('href', '/cong-ty/alpha-partners')
    const website = screen.getByRole('link', { name: /Website công ty/ })
    expect(website).toHaveAttribute('href', 'https://company.example/about')
    expect(website).toHaveAttribute('target', '_blank')
    expect(website).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('omits the website link when the company has none', () => {
    renderSidebar({ ...JOB, company_slug: 'alpha-partners' })

    expect(screen.getByRole('link', { name: /Xem trang công ty/ }))
      .toHaveAttribute('href', '/cong-ty/alpha-partners')
    expect(screen.queryByRole('link', { name: /Website công ty/ })).not.toBeInTheDocument()
  })

  it('falls back to the filtered public company directory when the company page is hidden', () => {
    renderSidebar({ ...JOB, company_slug: null })

    expect(screen.getByRole('link', { name: /Xem trang công ty/ }))
      .toHaveAttribute(
        'href',
        '/cong-ty/tim-kiem?keyword=C%C3%B4ng+ty+Alpha+%26+Partners',
      )
  })
})
