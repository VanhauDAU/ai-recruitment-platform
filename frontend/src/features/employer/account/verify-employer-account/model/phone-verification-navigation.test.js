// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getPasswordSetupFromPhoneUrl } from './phone-verification-navigation'

describe('getPasswordSetupFromPhoneUrl', () => {
  it('preserves phone verification as the explicit return destination', () => {
    expect(getPasswordSetupFromPhoneUrl(
      '/tuyendung/app/cai-dat/mat-khau',
      '/tuyendung/app/xac-thuc-so-dien-thoai',
    )).toBe(
      '/tuyendung/app/cai-dat/mat-khau'
      + '?returnUrl=%2Ftuyendung%2Fapp%2Fxac-thuc-so-dien-thoai',
    )
  })
})
