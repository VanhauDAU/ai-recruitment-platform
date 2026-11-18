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
    return Promise.reject(new Error('Mật khẩu phải từ 8 đến 25 ký tự'))
  }
  if (!requirements.composition) {
    return Promise.reject(new Error('Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số'))
  }
  return Promise.resolve()
}

export function employerPasswordValidationRule(_, value) {
  if (!value) return Promise.resolve()

  const requirements = getEmployerPasswordRequirements(value)
  if (!requirements.length) {
    return Promise.reject(new Error('Mật khẩu phải từ 8 đến 25 ký tự'))
  }
  if (!requirements.letterCase) {
    return Promise.reject(new Error('Mật khẩu phải có chữ in hoa và chữ thường'))
  }
  if (!requirements.number) {
    return Promise.reject(new Error('Mật khẩu phải có ít nhất 1 chữ số'))
  }
  if (!requirements.specialCharacter) {
    return Promise.reject(new Error('Mật khẩu phải có ít nhất 1 ký tự đặc biệt'))
  }
  return Promise.resolve()
}
