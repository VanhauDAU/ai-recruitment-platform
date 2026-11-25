import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OAuthCallback from './OAuthCallback'

const mocks = vi.hoisted(() => ({
  completeOAuth: vi.fn(),
  relayOAuthResult: vi.fn(),
  setCurrentUser: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/features/common/account/auth', () => ({
  completeOAuth: mocks.completeOAuth,
  getAuthDestination: () => '/dashboard',
  getSafeReturnUrl: (value) => value,
  relayOAuthResult: mocks.relayOAuthResult,
  withReturnUrl: (path) => path,
}))
vi.mock('@/entities/account/session', () => ({
  useSession: () => ({ setCurrentUser: mocks.setCurrentUser }),
}))
vi.mock('@/shared/lib/toast', () => ({
  message: { success: mocks.success },
}))
vi.mock('@/shared/ui/PageLoading', () => ({ default: () => <span>Loading</span> }))

function renderCallback(search) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/callback?${search}`]}>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/dashboard" element={<span>Dashboard</span>} />
        <Route path="/viec-lam" element={<span>Việc làm</span>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.completeOAuth.mockResolvedValue({ user: { role: 'candidate' } })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('hands the code to the opener window in popup mode and closes itself', async () => {
    const close = vi.fn()
    vi.stubGlobal('close', close)
    mocks.relayOAuthResult.mockResolvedValue(true)

    const view = renderCallback('code=one-time-code&next=%2Fviec-lam&popup=1&nonce=n0nce')

    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(mocks.relayOAuthResult).toHaveBeenCalledWith({ nonce: 'n0nce', code: 'one-time-code', error: null, next: '/viec-lam' })
    expect(mocks.completeOAuth).not.toHaveBeenCalled()
    expect(view.getByText('Việc làm')).toBeInTheDocument()
  })

  it('finishes the login inside the popup when no opener acknowledges', async () => {
    mocks.relayOAuthResult.mockResolvedValue(false)

    const view = renderCallback('code=one-time-code&popup=1&nonce=n0nce')

    expect(await view.findByText('Dashboard')).toBeInTheDocument()
    expect(mocks.completeOAuth).toHaveBeenCalledWith('one-time-code', 'main')
  })

  it('uses the done sound after a successful social login', async () => {
    renderCallback('code=one-time-code')

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(
      'Đăng nhập thành công.',
      { className: 'app-toast--sound-done' },
    ))
    expect(mocks.setCurrentUser).toHaveBeenCalledWith({ role: 'candidate' })
    expect(mocks.relayOAuthResult).not.toHaveBeenCalled()
  })
})
