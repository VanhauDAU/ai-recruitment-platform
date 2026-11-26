import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

// Máy có chuột: link nội bộ mở tab mới; điện thoại mở ngay trong trang (useNewTabLinkProps).
function stubPointer(fine) {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: fine, media: query, addEventListener() {}, removeEventListener() {},
  }))
}

describe('JobDetailSidebar company card', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows a compact company card that opens the company page in a new tab', () => {
    stubPointer(true)
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

  it('opens the company page in the same tab on touch screens', () => {
    stubPointer(false)
    renderSidebar({ ...JOB, company_slug: 'alpha-partners' })

    expect(screen.getByRole('link', { name: /Xem trang công ty/ })).not.toHaveAttribute('target')
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
