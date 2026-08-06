import { describe, expect, it } from 'vitest'
import { buildAnnouncementStripVisual } from './strip-visual-style'

describe('buildAnnouncementStripVisual', () => {
  it('sets CSS color variables from kind tokens', () => {
    const visual = buildAnnouncementStripVisual({ kind: 'success' })
    expect(visual.style['--announcement-accent']).toBe('#15803d')
    expect(visual.hasBackgroundImage).toBe(false)
    expect(visual.className).toBe('')
  })

  it('builds layered background when image is present', () => {
    const visual = buildAnnouncementStripVisual({
      kind: 'info',
      theme: { mode: 'preset', preset: 'ocean' },
      background: {
        imageUrl: 'https://cdn.example.com/980x31.webp',
        fit: 'cover',
        position: 'center',
        overlay: 'dark',
      },
    })
    expect(visual.hasBackgroundImage).toBe(true)
    expect(visual.className).toContain('has-bg')
    expect(visual.style.backgroundImage).toContain('url("https://cdn.example.com/980x31.webp")')
    expect(visual.style['--announcement-accent']).toBe('#0284c7')
  })
})
