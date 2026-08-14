import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import SearchCompanyCard from './SearchCompanyCard'

const COMPANY = {
  public_id: 'co_alpha',
  company_name: 'Công ty Alpha',
  trade_name: '',
  logo_url: '/logo.png',
  cover_image_url: '/cover-must-not-render.png',
  active_public_job_count: 12,
  description_excerpt: 'Môi trường làm việc chuyên nghiệp.',
}

function renderCard(company) {
  return render(
    <MemoryRouter>
      <SearchCompanyCard company={company} />
    </MemoryRouter>,
  )
}

describe('SearchCompanyCard', () => {
  it('renders a compact no-cover result with active jobs and headquarters', () => {
    const { container } = renderCard({ ...COMPANY, headquarters: 'TP. Hồ Chí Minh' })

    expect(screen.getByRole('heading', { name: 'Công ty Alpha' })).toBeVisible()
    expect(screen.getByText('Đang tuyển 12 vị trí')).toBeVisible()
    expect(screen.getByText('TP. Hồ Chí Minh')).toBeVisible()
    expect(screen.getByText(COMPANY.description_excerpt)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem việc làm tại Công ty Alpha' }))
      .toHaveClass('gap-2.5', 'rounded-lg', 'p-2.5', 'sm:p-3')
    expect(container.querySelector('img[src="/logo.png"]')).toHaveAttribute('width', '64')
    expect(container.querySelector('img[src="/logo.png"]')).toHaveAttribute('height', '64')
    expect(screen.getByRole('heading', { name: 'Công ty Alpha' }))
      .toHaveClass('text-sm', 'sm:text-base')
    expect(container.querySelector('img[src="/cover-must-not-render.png"]')).not.toBeInTheDocument()
    expect(container.querySelector('.company-directory-cover')).not.toBeInTheDocument()
  })

  it('omits the headquarters line when the API field is blank', () => {
    renderCard({ ...COMPANY, headquarters: '   ', active_public_job_count: undefined })

    expect(screen.queryByText('TP. Hồ Chí Minh')).not.toBeInTheDocument()
    expect(screen.getByText('Đang tuyển 0 vị trí')).toBeVisible()
  })
})
