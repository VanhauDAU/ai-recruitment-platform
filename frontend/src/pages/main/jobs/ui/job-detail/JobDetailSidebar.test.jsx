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

describe('JobDetailSidebar company card', () => {
  it('shows a compact company card that opens the company page in a new tab', () => {
    renderSidebar({
      ...JOB,
      company_slug: 'alpha-partners',
      company_size: '25-99',
      company_address: '27 Trần Duy Hưng, Hà Nội',
      company_website_url: 'https://company.example/about',
      company_description: 'Mô tả dài về công ty',
    })

    const companyLink = screen.getByRole('link', { name: /Xem trang công ty/ })
    expect(companyLink).toHaveAttribute('href', '/cong-ty/alpha-partners')
    expect(companyLink).toHaveAttribute('target', '_blank')
    expect(screen.getByText('25-99 nhân viên')).toBeInTheDocument()
    expect(screen.getByText('27 Trần Duy Hưng, Hà Nội')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Website công ty/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Mô tả dài về công ty')).not.toBeInTheDocument()
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
