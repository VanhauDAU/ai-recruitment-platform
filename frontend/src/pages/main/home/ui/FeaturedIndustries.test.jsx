import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import FeaturedIndustries from './FeaturedIndustries'

const INDUSTRIES = [
  { id: 46, name: 'Công nghệ thông tin', count: 1_200, logo_url: 'https://media.example/laptop.webp' },
  { id: 1, name: 'Kinh doanh/Bán hàng', count: 20, logo_url: '' },
]

function renderIndustries(industries, navigate = vi.fn()) {
  return render(
    <MemoryRouter>
      <FeaturedIndustries industries={industries} navigate={navigate} />
    </MemoryRouter>,
  )
}

describe('FeaturedIndustries', () => {
  it('shows each industry with its icon (or the fallback) and opens the filtered job list', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const { container } = renderIndustries(INDUSTRIES, navigate)

    const panel = screen.getByRole('region', { name: 'Top ngành nghề nổi bật' })
    const cards = panel.querySelectorAll('.featured-industries__card')
    expect(cards).toHaveLength(2)
    expect(cards[0].querySelector('img')).toHaveAttribute('src', 'https://media.example/laptop.webp')
    expect(cards[1].querySelector('img')).toBeNull()
    expect(cards[1].querySelector('.anticon-appstore')).toBeInTheDocument()
    expect(within(panel).getByText('1.200 việc làm')).toBeInTheDocument()

    // Một trang thì không cần nút chuyển trang và chấm trang.
    expect(within(panel).queryByRole('button', { name: 'Nhóm ngành nghề tiếp theo' })).toBeNull()
    expect(container.querySelector('.home-showcase__dots')).toBeNull()
    expect(within(panel).getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute('href', '/viec-lam')

    await user.click(within(panel).getByRole('button', { name: /Công nghệ thông tin/ }))
    expect(navigate).toHaveBeenCalledWith('/viec-lam?cat=46')
  })

  it('pages through more than eight industries', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, name: `Ngành ${index + 1}`, count: 9 - index }))
    renderIndustries(many)

    const panel = screen.getByRole('region', { name: 'Top ngành nghề nổi bật' })
    const next = within(panel).getByRole('button', { name: 'Nhóm ngành nghề tiếp theo' })
    expect(within(panel).getByRole('button', { name: 'Nhóm ngành nghề trước' })).toBeDisabled()

    await user.click(next)
    expect(next).toBeDisabled()
    expect(panel.querySelectorAll('.home-showcase__dot.is-active')).toHaveLength(1)
  })

  it('renders nothing without industries', () => {
    const { container } = renderIndustries([])
    expect(container).toBeEmptyDOMElement()
  })
})
