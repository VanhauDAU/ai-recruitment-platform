import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OAuthCallback from './OAuthCallback'

const mocks = vi.hoisted(() => ({
  completeOAuth: vi.fn(),
  setCurrentUser: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  completeOAuth: mocks.completeOAuth,
  getAuthDestination: () => '/dashboard',
  getSafeReturnUrl: (value) => value,
  withReturnUrl: (path) => path,
}))
vi.mock('@/entities/session', () => ({
  useSession: () => ({ setCurrentUser: mocks.setCurrentUser }),
}))
vi.mock('@/shared/lib/toast', () => ({
  message: { success: mocks.success },
}))
vi.mock('@/shared/ui/PageLoading', () => ({ default: () => <span>Loading</span> }))

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.completeOAuth.mockResolvedValue({ user: { role: 'candidate' } })
  })

  it('uses the done sound after a successful social login', async () => {
    render(
      <MemoryRouter initialEntries={['/oauth/callback?code=one-time-code']}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/dashboard" element={<span>Dashboard</span>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(
      'Đăng nhập thành công.',
      { className: 'app-toast--sound-done' },
    ))
    expect(mocks.setCurrentUser).toHaveBeenCalledWith({ role: 'candidate' })
  })
})
