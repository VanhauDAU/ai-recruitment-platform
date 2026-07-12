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
})
