import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BlogBenefits from './BlogBenefits'

vi.mock('@/entities/system/site-settings', () => ({
  DEFAULT_SITE_SETTINGS: { site_name: 'ProCV' },
  settingText: (value, fallback) => value || fallback,
  useSiteSettings: () => ({ settings: { site_name: 'ProCV' } }),
}))

const renderBenefits = () => render(<MemoryRouter><BlogBenefits /></MemoryRouter>)

describe('BlogBenefits', () => {
  beforeEach(() => window.localStorage.clear())

  it('stays hidden on later articles once the reader closes it', () => {
    const { unmount } = renderBenefits()
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn khối lợi ích' }))
    expect(screen.queryByText('Lợi ích khi sử dụng ProCV')).not.toBeInTheDocument()
    unmount()

    renderBenefits()
    expect(screen.queryByText('Lợi ích khi sử dụng ProCV')).not.toBeInTheDocument()
  })

  it('is desktop-only so it never pushes the article below the fold on phones', () => {
    renderBenefits()
    expect(screen.getByText('Lợi ích khi sử dụng ProCV').closest('section')).toHaveClass('hidden', 'sm:block')
  })
})
