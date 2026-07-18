import { describe, expect, it } from 'vitest'
import { formatServicePrice } from './format-price'
import { pickLocalized } from './pick-localized'

describe('service package presentation', () => {
  it('falls back to Vietnamese when English copy is empty', () => {
    expect(pickLocalized({ name_vi: 'Gói AI', name_en: '' }, 'name', 'en')).toBe('Gói AI')
    expect(pickLocalized({ name_vi: 'Gói AI', name_en: 'AI plan' }, 'name', 'en')).toBe('AI plan')
    expect(pickLocalized({ benefits_vi: ['Lọc CV'], benefits_en: [] }, 'benefits', 'en')).toEqual(['Lọc CV'])
  })

  it('formats numeric prices and leaves contact prices to the UI', () => {
    expect(formatServicePrice('7500000', 'VND', 'vi')).toBe('7.500.000 ₫')
    expect(formatServicePrice(120, 'USD', 'en')).toBe('120 USD')
    expect(formatServicePrice(null)).toBeNull()
  })
})
