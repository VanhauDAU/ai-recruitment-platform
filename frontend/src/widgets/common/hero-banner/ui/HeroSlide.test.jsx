import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import HeroSlide from './HeroSlide'

const company = {
  public_id: 'cmp_1',
  slug: 'eximland',
  company_name: 'Công ty Eximland',
  trade_name: 'Eximland',
  logo_url: '/logo.png',
  cover_image_url: '/cover.png',
  description_excerpt: 'Ngân hàng số',
  headquarters: 'Hà Nội',
  active_public_job_count: 12,
  industries_detail: [{ id: 1, name: 'Ngân hàng' }],
}

function renderSlide(banner, props = {}) {
  return render(
    <MemoryRouter>
      <HeroSlide banner={{ theme: 'green', ...banner }} {...props} />
    </MemoryRouter>,
  )
}

describe('HeroSlide', () => {
  it('renders an image slide as one link with alt text and tooltip', () => {
    renderSlide({ kind: 'image', title: 'Banner Eximland', image_url: '/b.png', cta_url: 'https://jobs.example.com/pfs' })
    const link = screen.getByRole('link', { name: 'Banner Eximland' })
    expect(link).toHaveAttribute('href', 'https://jobs.example.com/pfs')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('img', { name: 'Banner Eximland' })).toHaveAttribute('title', 'Banner Eximland')
  })

  it('falls back to the company page when an image slide has no link', () => {
    renderSlide({ kind: 'image', title: 'Banner', image_url: '/b.png', cta_url: '', company })
    expect(screen.getByRole('link', { name: 'Banner' })).toHaveAttribute('href', '/cong-ty/eximland')
  })

  it('renders a company slide from live company data', () => {
    renderSlide({ kind: 'company', title: '', subtitle: '', company })
    expect(screen.getByRole('heading', { name: 'Eximland' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem 12 việc làm' })).toHaveAttribute(
      'href',
      '/cong-ty/eximland?tab=viec-lam',
    )
    expect(screen.getByRole('link', { name: 'Xem công ty' })).toHaveAttribute('href', '/cong-ty/eximland')
  })

  it('shows guest copy on the AI slide without personal data', () => {
    renderSlide({ kind: 'ai', title: 'Tải CV lên', cta_label: 'Bắt đầu', cta_url: '/tai-cv-len' })
    expect(screen.getByRole('heading', { name: 'Tải CV lên' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bắt đầu' })).toHaveAttribute('href', '/tai-cv-len')
  })

  it('personalises the AI slide for a candidate with matches or missing preferences', () => {
    const banner = { kind: 'ai', title: 'Khách', cta_label: 'Bắt đầu', cta_url: '/tai-cv-len' }
    const { unmount } = renderSlide(banner, {
      personal: { status: 'ready', total: 37, href: '/tai-khoan/viec-lam-phu-hop' },
    })
    expect(screen.getByRole('heading', { name: 'Có 37 việc làm hợp với CV của bạn' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem việc phù hợp' })).toHaveAttribute('href', '/tai-khoan/viec-lam-phu-hop')
    unmount()

    renderSlide(banner, { personal: { status: 'preferences_required', total: 0, href: '/tai-khoan/viec-lam-phu-hop' } })
    expect(screen.getByRole('link', { name: 'Thiết lập ngay' })).toBeInTheDocument()
  })

  it('renders a promo slide with its call to action', () => {
    renderSlide({ kind: 'promo', title: 'Tạo CV', eyebrow: 'MIỄN PHÍ', cta_label: 'Chọn mẫu CV', cta_url: '/mau-cv' })
    expect(screen.getByText('MIỄN PHÍ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chọn mẫu CV' })).toHaveAttribute('href', '/mau-cv')
  })
})
