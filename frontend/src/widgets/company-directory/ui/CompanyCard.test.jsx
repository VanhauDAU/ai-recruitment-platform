import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import CompanyCard from './CompanyCard'

const COMPANY = {
  public_id: 'co_alpha',
  company_name: 'Công ty Alpha',
  trade_name: '',
  description_excerpt: '',
  industries_detail: [],
}

function renderCard(company, props = {}) {
  const result = render(
    <MemoryRouter>
      <CompanyCard company={company} {...props} />
    </MemoryRouter>,
  )
  return result.container
}

describe('CompanyCard media stability', () => {
  it('reserves the 1024:480 cover ratio and lazy-decodes offscreen media', () => {
    const container = renderCard({
      ...COMPANY,
      logo_url: '/logo.png',
      cover_image_url: '/cover.png',
    })

    expect(container.querySelector('.company-directory-cover')).toHaveClass('aspect-[32/15]')
    const cover = container.querySelector('.company-directory-cover > img')
    expect(cover).toHaveAttribute('width', '1024')
    expect(cover).toHaveAttribute('height', '480')
    expect(cover).toHaveAttribute('loading', 'lazy')
    expect(cover).toHaveAttribute('decoding', 'async')
    const logo = container.querySelector('img[src="/logo.png"]')
    expect(logo).toHaveAttribute('width', '72')
    expect(logo).toHaveAttribute('height', '72')
    expect(logo).toHaveAttribute('loading', 'lazy')
    expect(logo).toHaveAttribute('decoding', 'async')
  })

  it('keeps the code-native fallback visible when a search result has no cover', () => {
    const container = renderCard({ ...COMPANY, cover_image_url: '' }, { eager: true })

    expect(container.querySelector('.company-directory-cover-fallback')).toBeInTheDocument()
    expect(container.querySelector('.company-directory-cover > img')).not.toBeInTheDocument()
  })
})
