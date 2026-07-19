export const TWO_FACTOR_CODE_LENGTH = 6

export function sanitizeTwoFactorCode(value, length = TWO_FACTOR_CODE_LENGTH) {
  return String(value || '').replace(/\D/g, '').slice(0, length)
}
