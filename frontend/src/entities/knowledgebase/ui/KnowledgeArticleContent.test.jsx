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

  it('keeps a sanitized HTTPS image without requiring a ProCV media path', () => {
    const { container } = render(
      <KnowledgeArticleContent html='<img src="https://cdn.example.com/help/step.webp" alt="Các bước thao tác">' />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/help/step.webp',
    )
  })
})
