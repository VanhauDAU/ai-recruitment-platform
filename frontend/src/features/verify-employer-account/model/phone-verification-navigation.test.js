import { describe, expect, it } from 'vitest'
import { getPasswordSetupFromPhoneUrl } from './phone-verification-navigation'

describe('getPasswordSetupFromPhoneUrl', () => {
  it('preserves phone verification as the explicit return destination', () => {
    expect(getPasswordSetupFromPhoneUrl(
      '/tuyendung/app/account/settings/password-login',
      '/tuyendung/app/account/phone-verify',
    )).toBe(
      '/tuyendung/app/account/settings/password-login'
      + '?returnUrl=%2Ftuyendung%2Fapp%2Faccount%2Fphone-verify',
    )
  })
})
