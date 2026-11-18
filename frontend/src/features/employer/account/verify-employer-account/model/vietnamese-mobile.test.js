import { describe, expect, it } from 'vitest'
import { isVietnameseMobile } from './vietnamese-mobile'

describe('isVietnameseMobile', () => {
  it('accepts Vietnamese mobile numbers in local and canonical formats', () => {
    expect(isVietnameseMobile('0912 345 678')).toBe(true)
    expect(isVietnameseMobile('+84 912 345 678')).toBe(true)
  })

  it('rejects landline, foreign and malformed values', () => {
    expect(isVietnameseMobile('02412345678')).toBe(false)
    expect(isVietnameseMobile('+12025550123')).toBe(false)
    expect(isVietnameseMobile('not-a-phone')).toBe(false)
  })
})
