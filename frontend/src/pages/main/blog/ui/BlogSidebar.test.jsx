import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import BlogSidebar from './BlogSidebar'

vi.mock('@/entities/site-settings', () => ({
  getBanners: vi.fn(() => Promise.resolve([])),
  settingText: (value, fallback) => value || fallback,
  useSiteSettings: () => ({
    settings: { blog_support_docs_title: 'Tài liệu hỗ trợ tìm việc' },
  }),
}))

vi.mock('@/entities/job', () => ({
  getJobSuggestions: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/entities/location', () => ({
  getProvinces: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/entities/blog', () => ({
  blogPostPath: (slug) => `/blog/${slug}`,
  getBlogPinnedPosts: vi.fn(() => Promise.resolve([
    { slug: 'kinh-nghiem-phong-van', title: 'Kinh nghiệm phỏng vấn' },
  ])),
}))

describe('BlogSidebar support documents', () => {
  it('uses black by default and the configured brand color for interactive states', async () => {
    render(<MemoryRouter><BlogSidebar /></MemoryRouter>)

    const heading = await screen.findByRole('heading', { name: 'Tài liệu hỗ trợ tìm việc' })
    const link = screen.getByRole('link', { name: /Kinh nghiệm phỏng vấn/ })

    expect(heading).toHaveClass('text-slate-950')
    expect(link.className).toContain('!text-slate-950')
    expect(link.className).toContain('hover:!text-[var(--brand-primary)]')
    expect(link.className).toContain('focus-visible:!text-[var(--brand-primary)]')
  })
})
