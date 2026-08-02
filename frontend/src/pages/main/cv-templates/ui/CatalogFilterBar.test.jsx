import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import CatalogFilterBar from './CatalogFilterBar'

vi.mock('./LocaleDropdown', () => ({
  default: () => <div data-testid="locale-dropdown" />,
}))

const CATEGORIES = [
  { slug: 'don-gian', name: 'Đơn giản', category_type: 'style' },
  { slug: 'hien-dai', name: 'Hiện đại', category_type: 'style' },
  { slug: 'sinh-vien', name: 'Sinh viên', category_type: 'audience' },
  { slug: 'marketing', name: 'Marketing', category_type: 'position' },
  { slug: 'than-thien-ats', name: 'Thân thiện ATS', category_type: 'feature' },
]

function setup(props = {}) {
  const onSelect = vi.fn()
  render(
    <CatalogFilterBar
      categories={CATEGORIES}
      activeSlug={null}
      onSelect={onSelect}
      locale="vi-VN"
      localeOptions={[]}
      onLocaleChange={vi.fn()}
      {...props}
    />,
  )
  return { onSelect }
}

/** jsdom reports every element as 0×0, so overflow has to be simulated. */
function simulateOverflow(track, { scrollLeft = 0, clientWidth = 400, scrollWidth = 1200 } = {}) {
  Object.defineProperty(track, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(track, 'scrollWidth', { value: scrollWidth, configurable: true })
  track.scrollLeft = scrollLeft
  fireEvent.scroll(track)
}

describe('CatalogFilterBar', () => {
  beforeAll(() => {
    globalThis.ResizeObserver ||= class {
      observe() {}
      disconnect() {}
    }
    Element.prototype.scrollIntoView ||= () => {}
  })

  it('keeps every category on one scrollable row grouped by type', () => {
    setup()

    const track = screen.getByRole('group', { name: 'Lọc mẫu CV theo danh mục' })
    // A wrapping bar was the problem: the row must scroll instead of growing.
    expect(track.className).toContain('overflow-x-auto')
    for (const category of CATEGORIES) {
      expect(within(track).getByRole('button', { name: category.name })).toBeInTheDocument()
    }
    // style, audience, position, feature -> three separators between four groups.
    expect(track.querySelectorAll('[data-role="group-separator"]')).toHaveLength(3)
  })

  it('pins the reset pill outside the scroller and reports the active filter', () => {
    setup({ activeSlug: 'hien-dai' })

    const track = screen.getByRole('group', { name: 'Lọc mẫu CV theo danh mục' })
    const reset = screen.getByRole('button', { name: 'Tất cả' })
    expect(track).not.toContainElement(reset)
    expect(reset).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Hiện đại' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selects a category and resets the filter through the pinned pill', () => {
    const { onSelect } = setup({ activeSlug: 'hien-dai' })

    fireEvent.click(screen.getByRole('button', { name: 'Marketing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }))

    expect(onSelect).toHaveBeenNthCalledWith(1, CATEGORIES[3])
    expect(onSelect).toHaveBeenNthCalledWith(2, null)
  })

  it('only offers the scroll arrow for the direction that still has categories', () => {
    setup()
    const track = screen.getByRole('group', { name: 'Lọc mẫu CV theo danh mục' })

    simulateOverflow(track, { scrollLeft: 0 })
    expect(screen.queryByRole('button', { name: 'Xem danh mục trước đó' })).not.toBeInTheDocument()
    const forward = screen.getByRole('button', { name: 'Xem thêm danh mục' })

    track.scrollBy = vi.fn()
    fireEvent.click(forward)
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' })

    simulateOverflow(track, { scrollLeft: 800 })
    expect(screen.getByRole('button', { name: 'Xem danh mục trước đó' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem thêm danh mục' })).not.toBeInTheDocument()
  })
})
