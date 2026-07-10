export function getPasswordRequirements(password = '') {
  return {
    length: password.length >= 6 && password.length <= 25,
    composition: /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password),
  }
}

export function passwordValidationRule(_, value) {
  if (!value) return Promise.resolve()

  const requirements = getPasswordRequirements(value)
  if (!requirements.length) {
    return Promise.reject(new Error('Mật khẩu phải từ 6 đến 25 ký tự'))
  }
  if (!requirements.composition) {
    return Promise.reject(new Error('Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số'))
  }
  return Promise.resolve()
}
