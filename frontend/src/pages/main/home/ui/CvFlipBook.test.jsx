import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import CvFlipBook from './CvFlipBook'

const media = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/shared/hooks/use-media-query', () => ({ useMediaQuery: () => media.reduced }))

const TEMPLATES = ['Thanh Lịch', 'Chuyên Nghiệp', 'Hiện Đại', 'Đỉnh Cao'].map((name, index) => ({
  public_id: `t${index}`,
  slug: `mau-${index}`,
  display_name: name,
  thumbnail_url: `/t${index}.png`,
  colors: [],
}))

const renderBook = () => render(<MemoryRouter><CvFlipBook templates={TEMPLATES} loading={false} /></MemoryRouter>)
const leaf = (container) => container.querySelector('.cv-book__leaf')
// jsdom không có AnimationEvent nên React nghe bản có tiền tố webkit.
const endTurn = (container) => act(() => fireEvent(leaf(container), new Event('webkitAnimationEnd', { bubbles: true })))

beforeEach(() => {
  media.reduced = false
})

test('opens on the cover and template 1, and turns a leaf to the next spread', () => {
  const { container } = renderBook()

  expect(screen.getByText('Sổ tay mẫu CV', { selector: 'p' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Xem mẫu CV Thanh Lịch' })).toHaveAttribute('href', '/mau-cv/chi-tiet/mau-0')
  expect(screen.getAllByText('Trang 1–2/6').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Lật sang trang sau' }))
  expect(leaf(container)).toHaveClass('cv-book__leaf--next')
  expect(container.querySelector('[data-turning="next"]')).toBeInTheDocument()

  endTurn(container)
  expect(leaf(container)).toBeNull()
  expect(screen.getByRole('link', { name: 'Xem mẫu CV Chuyên Nghiệp' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Xem mẫu CV Hiện Đại' })).toBeInTheDocument()
  expect(screen.getAllByText('Trang 3–4/6').length).toBeGreaterThan(0)
})

test('previous from the first spread wraps to the last one with the "see all" page', () => {
  const { container } = renderBook()

  fireEvent.click(screen.getByRole('button', { name: 'Lật về trang trước' }))
  endTurn(container)

  expect(screen.getByRole('link', { name: /Xem tất cả mẫu CV/ })).toHaveAttribute('href', '/mau-cv')
  expect(screen.getAllByText('Trang 5–6/6').length).toBeGreaterThan(0)
})

test('reduced motion turns instantly without a leaf', () => {
  media.reduced = true
  const { container } = renderBook()

  fireEvent.click(screen.getByRole('button', { name: 'Lật sang trang sau' }))
  expect(leaf(container)).toBeNull()
  expect(screen.getAllByText('Trang 3–4/6').length).toBeGreaterThan(0)
})
