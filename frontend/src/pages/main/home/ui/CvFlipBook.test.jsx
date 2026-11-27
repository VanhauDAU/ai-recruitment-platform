import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import CvFlipBook from './CvFlipBook'

const media = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/shared/hooks/use-media-query', () => ({ useMediaQuery: () => media.reduced }))
const sound = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('@/shared/lib/sound-player', () => ({ playSoundEffect: sound.play }))

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
  sound.play.mockClear()
})

const book = (container) => container.querySelector('.cv-book')

test('starts closed on the cover; turning the cover opens the intro and the first template', () => {
  const { container } = renderBook()

  expect(book(container)).toHaveAttribute('data-closed')
  expect(container.querySelector('.cv-book__page--left')).toBeNull()
  expect(screen.getByText('Bộ sưu tập 4 mẫu CV')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lật về trang trước' })).toBeDisabled()
  expect(screen.getAllByText('Trang Bìa/7').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Lật sang trang sau' }))
  expect(sound.play).toHaveBeenCalledWith('pageFlip')
  expect(leaf(container)).toHaveClass('cv-book__leaf--next')
  // Sách trượt ra giữa ngay khi bìa bắt đầu lật.
  expect(book(container)).not.toHaveAttribute('data-closed')

  endTurn(container)
  expect(leaf(container)).toBeNull()
  expect(container.querySelector('.cv-book__page--left')).toHaveTextContent('Sổ tay mẫu CV')
  expect(screen.getByRole('link', { name: 'Xem mẫu CV Thanh Lịch' })).toHaveAttribute('href', '/mau-cv/chi-tiet/mau-0')
  expect(screen.getAllByText('Trang 2–3/7').length).toBeGreaterThan(0)
})

test('after the last spread the book closes back to the cover', () => {
  const { container } = renderBook()
  fireEvent.change(screen.getByRole('slider', { name: 'Chọn trang' }), { target: { value: '5' } })
  expect(screen.getByRole('link', { name: /Xem tất cả mẫu CV/ })).toHaveAttribute('href', '/mau-cv')

  fireEvent.click(screen.getByRole('button', { name: 'Lật sang trang sau' }))
  expect(leaf(container)).toHaveClass('cv-book__leaf--prev')
  expect(book(container)).toHaveAttribute('data-closed')

  endTurn(container)
  expect(container.querySelector('.cv-book__page--left')).toBeNull()
  expect(screen.getByText('Bộ sưu tập 4 mẫu CV')).toBeInTheDocument()
  expect(screen.getAllByText('Trang Bìa/7').length).toBeGreaterThan(0)
})

test('reduced motion turns instantly without a leaf', () => {
  media.reduced = true
  const { container } = renderBook()

  fireEvent.click(screen.getByRole('button', { name: 'Lật sang trang sau' }))
  expect(leaf(container)).toBeNull()
  expect(screen.getAllByText('Trang 2–3/7').length).toBeGreaterThan(0)
})
