import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import KnowledgeArticleContent from './KnowledgeArticleContent'

describe('KnowledgeArticleContent', () => {
  it('makes images lazy, preserves alt text and marks a broken image without breaking layout', () => {
    const { container } = render(
      <KnowledgeArticleContent html='<p>Nội dung</p><img src="/missing.webp" alt="Minh họa thao tác">' />,
    )
    const image = container.querySelector('img')

    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('decoding', 'async')
    expect(image).toHaveAttribute('alt', 'Minh họa thao tác')
    fireEvent.error(image)
    expect(image).toHaveClass('is-broken')
    expect(image).toHaveAttribute('data-load-error', 'true')
  })
})
