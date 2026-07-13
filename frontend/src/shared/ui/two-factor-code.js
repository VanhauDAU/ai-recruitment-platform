export const TWO_FACTOR_CODE_LENGTH = 6

export function sanitizeTwoFactorCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, TWO_FACTOR_CODE_LENGTH)
}
