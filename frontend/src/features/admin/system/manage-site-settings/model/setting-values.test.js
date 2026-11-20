import { describe, expect, it } from 'vitest'
import { formatSettingValue, isRiskyChange, matchesQuery, whiteContrastRatio } from './setting-values'

describe('setting values', () => {
  it('flags only the dangerous direction of a risky switch', () => {
    const on = { options: { risky: 'on' } }
    const off = { options: { risky: 'off' } }
    expect(isRiskyChange(on, false, true)).toBe(true)
    expect(isRiskyChange(on, true, false)).toBe(false)
    expect(isRiskyChange(off, true, false)).toBe(true)
    expect(isRiskyChange({ options: {} }, true, false)).toBe(false)
  })

  it('formats values and matches searches on label, key and section', () => {
    expect(formatSettingValue({ value_type: 'boolean' }, true)).toBe('Bật')
    expect(formatSettingValue({ value_type: 'text' }, '')).toBe('(trống)')
    const setting = { label: 'Tên site', key: 'site_name', section: 'Nhận diện' }
    expect(matchesQuery(setting, 'SITE_')).toBe(true)
    expect(matchesQuery(setting, 'nhận')).toBe(true)
    expect(matchesQuery(setting, 'hotline')).toBe(false)
  })

  it('computes the WCAG contrast of white text', () => {
    expect(whiteContrastRatio('#000000')).toBeCloseTo(21, 0)
    expect(whiteContrastRatio('#00b14f')).toBeLessThan(4.5)
    expect(whiteContrastRatio('#19734e')).toBeGreaterThan(4.5)
    expect(whiteContrastRatio('green')).toBeNull()
  })
})
