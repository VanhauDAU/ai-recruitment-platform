import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { COMPANY_DIRECTORY_PATH } from '@/entities/company'
import FeaturedEmployers from './FeaturedEmployers'

const EMPLOYERS = [
  {
    public_id: 'company_alpha',
    company_name: 'Công ty A&B',
    logo_url: '/logos/alpha.png',
    active_public_job_count: 1_000,
    industries_detail: [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe' }],
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    public_id: `company_${index + 2}`,
    company_name: `Công ty ${index + 2}`,
    logo_url: `/logos/company-${index + 2}.png`,
    active_public_job_count: index + 2,
    industries_detail: [],
  })),
]

const PLATFORM_STATS = {
  candidates: 690_167,
  active_jobs: 90_224,
  employers: 67_740,
}

describe('FeaturedEmployers', () => {
  it('renders formatted statistics, six cards per page, pagination state and the logo marquee after the panel', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter>
        <FeaturedEmployers employers={EMPLOYERS} navigate={vi.fn()} stats={PLATFORM_STATS} />
      </MemoryRouter>,
    )

    const statistics = screen.getByRole('region', { name: 'Website của chúng tôi có' })
    expect(within(statistics).getByText('690.167')).toBeInTheDocument()
    expect(within(statistics).getByText('90.224')).toBeInTheDocument()
    expect(within(statistics).getByText('67.740')).toBeInTheDocument()
    expect(within(statistics).getByText('Ứng viên')).toBeInTheDocument()
    expect(within(statistics).getByText('Việc làm')).toBeInTheDocument()
    expect(within(statistics).getByText('Nhà tuyển dụng')).toBeInTheDocument()

    const panel = screen.getByRole('region', { name: 'Công ty nổi bật' })
    const cards = panel.querySelectorAll('.featured-employer-card')
    expect(cards).toHaveLength(7)
    expect(cards[0].parentElement.querySelectorAll('.featured-employer-card')).toHaveLength(6)
    expect(cards[6].parentElement.querySelectorAll('.featured-employer-card')).toHaveLength(1)
    expect(cards[0].parentElement).not.toBe(cards[6].parentElement)
    expect(within(panel).getByText('1.000 Việc làm')).toBeInTheDocument()
    expect(within(panel).getByText('7 Việc làm')).toBeInTheDocument()
    expect(within(panel).getByText('Công nghệ')).toBeInTheDocument()

    expect(within(panel).getByRole('button', { name: 'Nhóm công ty trước' })).toBeDisabled()
    expect(within(panel).getByRole('button', { name: 'Nhóm công ty tiếp theo' })).toBeEnabled()

    let pageStatus = within(panel).getByRole('status', { name: 'Trang 1 trên 2' })
    let dots = pageStatus.querySelectorAll('span')
    expect(dots).toHaveLength(2)
    expect(dots[0]).toHaveClass('bg-[var(--brand-primary)]')
    expect(dots[1]).toHaveClass('bg-emerald-200')

    await user.click(within(panel).getByRole('button', { name: 'Nhóm công ty tiếp theo' }))

    expect(within(panel).getByRole('button', { name: 'Nhóm công ty trước' })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Nhóm công ty tiếp theo' })).toBeDisabled()
    pageStatus = within(panel).getByRole('status', { name: 'Trang 2 trên 2' })
    dots = pageStatus.querySelectorAll('span')
    expect(dots[0]).toHaveClass('bg-emerald-200')
    expect(dots[1]).toHaveClass('bg-[var(--brand-primary)]')

    await user.click(within(panel).getByRole('button', { name: 'Nhóm công ty trước' }))
    expect(within(panel).getByRole('status', { name: 'Trang 1 trên 2' })).toBeInTheDocument()

    const marquee = container.querySelector('.employer-logo-full-bleed-marquee')
    expect(marquee).toBeInTheDocument()
    expect(panel.compareDocumentPosition(marquee) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps company-card search navigation and the view-all destination', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    render(
      <MemoryRouter>
        <FeaturedEmployers employers={EMPLOYERS} navigate={navigate} stats={PLATFORM_STATS} />
      </MemoryRouter>,
    )

    const panel = screen.getByRole('region', { name: 'Công ty nổi bật' })
    await user.click(within(panel).getByRole('button', { name: /Công ty A&B/ }))
    expect(navigate).toHaveBeenLastCalledWith(
      '/viec-lam?search=C%C3%B4ng%20ty%20A%26B&search_by=company',
    )

    expect(within(panel).getByRole('link', { name: 'Xem tất cả' }))
      .toHaveAttribute('href', COMPANY_DIRECTORY_PATH)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when there are no featured employers', () => {
    const { container } = render(
      <FeaturedEmployers employers={[]} navigate={vi.fn()} stats={PLATFORM_STATS} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
