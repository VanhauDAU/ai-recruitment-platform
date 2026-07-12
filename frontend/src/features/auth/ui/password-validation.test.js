import { describe, expect, it } from 'vitest'
import { getPasswordRequirements, passwordValidationRule } from './password-validation'

describe('password validation', () => {
  it('accepts passwords with 6–25 characters, upper/lower case and a digit', async () => {
    expect(getPasswordRequirements('Abc123')).toEqual({ length: true, composition: true })
    await expect(passwordValidationRule(null, 'Abc123')).resolves.toBeUndefined()
  })

  it('rejects passwords outside the allowed length', async () => {
    expect(getPasswordRequirements('Abc12')).toEqual({ length: false, composition: true })
    await expect(passwordValidationRule(null, 'Abc12')).rejects.toThrow('Mật khẩu phải từ 6 đến 25 ký tự')

    const tooLongPassword = `Ab${'c'.repeat(23)}1`
    expect(getPasswordRequirements(tooLongPassword).length).toBe(false)
  })

  it('requires uppercase, lowercase and numeric characters', async () => {
    expect(getPasswordRequirements('abcdef1')).toEqual({ length: true, composition: false })
    await expect(passwordValidationRule(null, 'abcdef1')).rejects.toThrow('Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số')
  })
})
