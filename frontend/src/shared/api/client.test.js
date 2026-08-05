import { beforeEach, describe, expect, it, vi } from 'vitest'

// `client.js` chưa từng có test: mọi suite khác đều mock nguyên module này, nên
// interceptor 401, single-flight refresh và nhánh xử lý lỗi chưa được phủ ở bất
// kỳ cấp nào. Ở đây ta mock axios để bắt lấy chính các handler đã đăng ký.
const mocks = vi.hoisted(() => ({
  responseHandlers: [],
  requestHandlers: [],
  instance: vi.fn(),
  post: vi.fn(),
  getAccessToken: vi.fn(() => 'access-token'),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  notifyPermissionDenied: vi.fn(),
  notifySessionExpired: vi.fn(),
  getCurrentPortal: vi.fn(() => 'employer'),
}))

vi.mock('axios', () => ({
  default: {
    create: () => {
      mocks.instance.interceptors = {
        request: {
          use: (onFulfilled, onRejected) =>
            mocks.requestHandlers.push({ onFulfilled, onRejected }),
        },
        response: {
          use: (onFulfilled, onRejected) =>
            mocks.responseHandlers.push({ onFulfilled, onRejected }),
        },
      }
      return mocks.instance
    },
    post: mocks.post,
  },
}))

vi.mock('./token-store', () => ({
  getAccessToken: mocks.getAccessToken,
  setTokens: mocks.setTokens,
  clearTokens: mocks.clearTokens,
  notifyPermissionDenied: mocks.notifyPermissionDenied,
  notifySessionExpired: mocks.notifySessionExpired,
}))

vi.mock('@/shared/config/portals', () => ({ getCurrentPortal: mocks.getCurrentPortal }))

await import('./client')

const onResponseError = mocks.responseHandlers[0].onRejected

function unauthorized(url = '/employer/me/') {
  return { response: { status: 401 }, config: { url, headers: {} } }
}

describe('HTTP client interceptor', () => {
  beforeEach(() => {
    mocks.post.mockReset()
    mocks.instance.mockReset()
    mocks.setTokens.mockClear()
    mocks.clearTokens.mockClear()
    mocks.notifySessionExpired.mockClear()
    mocks.notifyPermissionDenied.mockClear()
  })

  it('refreshes once and replays the original request on a 401', async () => {
    mocks.post.mockResolvedValue({ data: { access: 'renewed' } })
    mocks.instance.mockResolvedValue({ data: 'ok' })

    await expect(onResponseError(unauthorized())).resolves.toEqual({ data: 'ok' })

    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.setTokens).toHaveBeenCalledWith({ access: 'renewed' })
  })

  it('collapses concurrent 401s into a single refresh call', async () => {
    mocks.post.mockResolvedValue({ data: { access: 'renewed' } })
    mocks.instance.mockResolvedValue({ data: 'ok' })

    await Promise.all([
      onResponseError(unauthorized('/employer/me/')),
      onResponseError(unauthorized('/employer/company/')),
      onResponseError(unauthorized('/jobs/')),
    ])

    expect(mocks.post).toHaveBeenCalledTimes(1)
  })

  it('announces an expired session when the refresh definitively fails', async () => {
    // Không phát tín hiệu thì SessionProvider giữ nguyên isAuthenticated=true:
    // guard vẫn render workspace NTD trong khi mọi request đều 401 âm thầm.
    mocks.post.mockRejectedValue(new Error('refresh rejected'))
    const error = unauthorized()

    await expect(onResponseError(error)).rejects.toBe(error)

    expect(mocks.clearTokens).toHaveBeenCalled()
    expect(mocks.notifySessionExpired).toHaveBeenCalled()
  })

  it('passes through an error that carries no request config', async () => {
    // Huỷ request (AbortSignal ở checkRegistrationEmail) và lỗi ném từ request
    // interceptor đều tới đây mà không có `config`.
    const cancellation = { message: 'canceled' }

    await expect(onResponseError(cancellation)).rejects.toBe(cancellation)
  })

  it('never tries to refresh when the refresh endpoint itself returns 401', async () => {
    await expect(onResponseError(unauthorized('/auth/refresh/'))).rejects.toBeTruthy()

    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('notifies the admin permission listener on a denied admin action', async () => {
    const denied = {
      response: { status: 403, data: { code: 'admin_permission_denied' } },
      config: { url: '/admin/accounts/', headers: {} },
    }

    await expect(onResponseError(denied)).rejects.toBe(denied)

    expect(mocks.notifyPermissionDenied).toHaveBeenCalled()
  })
})
