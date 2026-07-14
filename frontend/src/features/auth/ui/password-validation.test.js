import { describe, expect, it } from 'vitest'
import { getPasswordRequirements, passwordValidationRule } from './password-validation'

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
})
