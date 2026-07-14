import { describe, expect, it } from 'vitest'
import { templateColors, templatePreviewForColor } from './template-colors'

describe('CV template colors', () => {
  it('orders the database default first and resolves its own preview URL', () => {
    const template = {
      preview_url: '/fallback.png',
      colors: [
        { slug: 'blue', hex_code: '#112233', preview_url: '/blue.png', is_default: false },
        { slug: 'green', hex_code: '#00A66A', preview_url: '/green.png', is_default: true },
      ],
    }

    const colors = templateColors(template)
    expect(colors.map((color) => color.slug)).toEqual(['green', 'blue'])
    expect(templatePreviewForColor(template, colors[1])).toBe('/blue.png')
  })

  it('keeps one compatibility color for old API responses', () => {
    expect(templateColors({ theme_color: '#445566', thumbnail_url: '/legacy.png' })).toEqual([
      expect.objectContaining({ hex_code: '#445566', preview_url: '/legacy.png' }),
    ])
  })
})
