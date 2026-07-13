import { describe, expect, it } from 'vitest'
import { sanitizeTwoFactorCode } from './two-factor-code'

describe('sanitizeTwoFactorCode', () => {
  it('keeps only six numeric characters', () => {
    expect(sanitizeTwoFactorCode('a12b34c56d7')).toBe('123456')
  })
})
