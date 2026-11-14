import { describe, expect, it } from 'vitest'
import { companyDisplayName, companyInitial } from './company-presentation'

describe('company presentation', () => {
  it('prefers the trade name and falls back to the registered name', () => {
    expect(companyDisplayName({ trade_name: 'ProCV', company_name: 'Công ty TNHH ProCV' })).toBe('ProCV')
    expect(companyDisplayName({ trade_name: '', company_name: ' Công ty TNHH ProCV ' })).toBe('Công ty TNHH ProCV')
  })

  it('never renders an empty name or initial', () => {
    expect(companyDisplayName(null)).toBe('Công ty')
    expect(companyDisplayName({ trade_name: '   ' })).toBe('Công ty')
    expect(companyInitial(undefined)).toBe('C')
  })

  it('uppercases the initial with Vietnamese casing rules', () => {
    expect(companyInitial({ trade_name: 'đại dương xanh' })).toBe('Đ')
  })
})
