import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import FeaturedPosts from './FeaturedPosts'

function makePost(index) {
  return {
    public_id: `post_${index}`,
    slug: `bai-viet-${index}`,
    title: `Bài viết ${index}`,
    excerpt: `Nội dung giới thiệu bài viết ${index}`,
    published_at: '2026-07-27T08:00:00Z',
    thumbnail_url: '',
    category: { name: 'Định hướng nghề nghiệp' },
  }
}

function renderFeatured(count) {
  return render(
    <MemoryRouter>
      <FeaturedPosts posts={Array.from({ length: count }, (_, index) => makePost(index + 1))} />
    </MemoryRouter>,
  )
}

describe('FeaturedPosts responsive content density', () => {
  it('does not render an empty featured section', () => {
    render(
      <MemoryRouter>
        <FeaturedPosts posts={[]} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: 'Bài viết nổi bật' })).not.toBeInTheDocument()
  })

  it.each([
    [1, 'solo'],
    [2, 'duo'],
    [3, 'editorial'],
    [4, 'editorial'],
  ])('uses the %s-post layout without placeholder cards', (count, layout) => {
    const { container } = renderFeatured(count)

    expect(container.querySelector(`[data-featured-layout="${layout}"]`)).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(count)
    expect(screen.getAllByRole('article')).toHaveLength(count)
  })

  it('limits the featured area to four posts', () => {
    renderFeatured(6)

    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.queryByRole('heading', { name: 'Bài viết 5' })).not.toBeInTheDocument()
  })
})
