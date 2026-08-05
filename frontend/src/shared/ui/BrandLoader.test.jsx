import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BrandLoader from './BrandLoader'
import PageLoading from './PageLoading'

const mockReducedMotion = (matches) => {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') && matches,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }))
}

describe('BrandLoader', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders the animated mascot and keeps it out of the accessibility tree', () => {
    const { container } = render(<BrandLoader size={96} />)
    const img = container.querySelector('img')

    expect(img).toHaveAttribute('src', '/images/loading/procv-loader.webp')
    expect(img).toHaveAttribute('aria-hidden', 'true')
    expect(img).toHaveAttribute('width', '96')
    expect(img).toHaveStyle({ width: '96px', height: '96px' })
  })

  it('swaps to the static frame when the visitor asks for reduced motion', () => {
    mockReducedMotion(true)
    const { container } = render(<BrandLoader />)

    expect(container.querySelector('img')).toHaveAttribute('src', '/images/loading/procv-loader-static.webp')
  })

  it('leaves sizing to CSS and drops the percent prop antd Spin injects', () => {
    const { container } = render(<BrandLoader className="spin-indicator" percent={40} />)
    const img = container.querySelector('img')

    expect(img).toHaveClass('spin-indicator')
    expect(img).not.toHaveAttribute('percent')
    expect(img).not.toHaveAttribute('width')
    expect(img.style.width).toBe('')
  })
})

describe('PageLoading', () => {
  it('announces the wait and shows the mascot', () => {
    const { container } = render(<PageLoading />)

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu...')
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/loading/procv-loader.webp')
  })
})
