import { describe, expect, it } from 'vitest'
import {
  employerPasswordValidationRule,
  getEmployerPasswordRequirements,
  getPasswordRequirements,
  passwordValidationRule,
} from './password-validation'

describe('password validation', () => {
  it('accepts an 8–25 character password', async () => {
    expect(getPasswordRequirements('Matkhau1')).toEqual({ length: true, composition: true })
    await expect(passwordValidationRule(null, 'Matkhau1')).resolves.toBeUndefined()
  })

  it('rejects passwords outside the allowed length', async () => {
    expect(getPasswordRequirements('matkhau')).toEqual({ length: false, composition: false })
    await expect(passwordValidationRule(null, 'matkhau')).rejects.toThrow('Mật khẩu phải từ 8 đến 25 ký tự')

    const tooLongPassword = 'a'.repeat(26)
    expect(getPasswordRequirements(tooLongPassword).length).toBe(false)
  })

  it('requires uppercase, lowercase and numeric characters', async () => {
    expect(getPasswordRequirements('matkhaudai')).toEqual({ length: true, composition: false })
    await expect(passwordValidationRule(null, 'matkhaudai')).rejects.toThrow('Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số')
  })

  it('requires a special character for employer registration', async () => {
    expect(getEmployerPasswordRequirements('Password1')).toEqual({
      length: true,
      letterCase: true,
      number: true,
      specialCharacter: false,
    })
    await expect(employerPasswordValidationRule(null, 'Password1')).rejects.toThrow('Mật khẩu phải có ít nhất 1 ký tự đặc biệt')
    await expect(employerPasswordValidationRule(null, 'Password@1')).resolves.toBeUndefined()
  })
})
