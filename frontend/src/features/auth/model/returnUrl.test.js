import { describe, expect, it } from 'vitest'
import { getReturnUrl, getSafeReturnUrl, withReturnUrl } from './returnUrl'

describe('return URL policy', () => {
  it('accepts an internal path, query and hash', () => {
    expect(getSafeReturnUrl('/tai-khoan/thong-tin-ca-nhan?tab=profile#phone'))
      .toBe('/tai-khoan/thong-tin-ca-nhan?tab=profile#phone')
  })

  it.each(['https://attacker.example', '//attacker.example', 'viec-lam', 'javascript:alert(1)'])(
    'rejects unsafe destination %s',
    (value) => expect(getSafeReturnUrl(value)).toBe(''),
  )

  it('adds the URL to a login path without overwriting existing search parameters', () => {
    expect(withReturnUrl('/login?reason=session', '/tai-khoan/xac-minh-hai-buoc'))
      .toBe('/login?reason=session&returnUrl=%2Ftai-khoan%2Fxac-minh-hai-buoc')
  })

  it('reads only a safe return URL from search params', () => {
    expect(getReturnUrl(new URLSearchParams('returnUrl=%2Fviec-lam%3Fq%3Dreact'))).toBe('/viec-lam?q=react')
    expect(getReturnUrl(new URLSearchParams('returnUrl=https%3A%2F%2Fattacker.example'))).toBe('')
  })
})
