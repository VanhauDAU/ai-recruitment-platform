import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitZoom } from './use-builder-ui'

describe('fitZoom', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps 80% on desktop', () => {
    expect(fitZoom(true)).toBe(0.8)
  })

  it('fits the A4 page inside a phone viewport with its gutters', () => {
    vi.stubGlobal('innerWidth', 390)
    const zoom = fitZoom(false)
    expect(zoom * 794 + 32).toBeLessThanOrEqual(390)
    expect(zoom).toBe(0.45)
  })

  it('stays between 30% and 80%', () => {
    vi.stubGlobal('innerWidth', 250)
    expect(fitZoom(false)).toBe(0.3)
    vi.stubGlobal('innerWidth', 834)
    expect(fitZoom(false)).toBe(0.8)
  })
})
