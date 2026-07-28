import { describe, expect, it } from 'vitest'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

describe('getApiErrorMessage', () => {
  it('translates the default SimpleJWT credentials error', () => {
    const error = {
      response: {
        status: 401,
        data: { detail: 'No active account found with the given credentials' },
      },
    }

    expect(getApiErrorMessage(error)).toBe('Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
  })

  it('does not render HTML returned by an upstream error page', () => {
    const error = { response: { status: 502, data: '<html><body>Bad Gateway</body></html>' } }
    expect(getApiErrorMessage(error)).toBe('Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.')
  })

  it('shows a structured business error without exposing its machine code', () => {
    const error = {
      response: {
        status: 409,
        data: {
          code: 'company_tax_code_conflict',
          message: 'Mã số thuế đã thuộc một công ty được xác thực.',
        },
      },
    }

    expect(getApiErrorMessage(error)).toBe('Mã số thuế đã thuộc một công ty được xác thực.')
  })
})
