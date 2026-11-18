import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    // Xanh lá thương hiệu: chữ trắng chưa đạt AA, chữ đen đạt.
    expect(contrastRatio('#00A66A', '#FFFFFF')).toBeLessThan(4.5)
    expect(contrastRatio('#00A66A', '#000000')).toBeGreaterThan(4.5)
  })
})
