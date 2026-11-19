import { m } from '@/shared/config/i18n'
export function getPasswordRequirements(password = '') {
  return {
    length: password.length >= 8 && password.length <= 25,
    composition: /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password),
  }
}

export function getEmployerPasswordRequirements(password = '') {
  return {
    length: password.length >= 8 && password.length <= 25,
    letterCase: /[A-Z]/.test(password) && /[a-z]/.test(password),
    number: /\d/.test(password),
    specialCharacter: /[^A-Za-z0-9]/.test(password),
  }
}

export function passwordValidationRule(_, value) {
  if (!value) return Promise.resolve()

  const requirements = getPasswordRequirements(value)
  if (!requirements.length) {
    return Promise.reject(new Error(m.account_password_error_length()))
  }
  if (!requirements.composition) {
    return Promise.reject(new Error(m.account_password_error_complexity()))
  }
  return Promise.resolve()
}

export function employerPasswordValidationRule(_, value) {
  if (!value) return Promise.resolve()

  const requirements = getEmployerPasswordRequirements(value)
  if (!requirements.length) {
    return Promise.reject(new Error(m.account_password_error_length()))
  }
  if (!requirements.letterCase) {
    return Promise.reject(new Error(m.account_auth_error_case()))
  }
  if (!requirements.number) {
    return Promise.reject(new Error(m.account_auth_error_digit()))
  }
  if (!requirements.specialCharacter) {
    return Promise.reject(new Error(m.account_auth_error_special()))
  }
  return Promise.resolve()
}
