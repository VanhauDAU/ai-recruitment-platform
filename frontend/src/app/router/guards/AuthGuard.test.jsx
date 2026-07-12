import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthGuard from './AuthGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))

describe('AuthGuard', () => {
  beforeEach(() => useSession.mockReset())

  it('redirects an unauthenticated visitor and preserves the destination', () => {
    useSession.mockReturnValue({ loading: false, isAuthenticated: false })

    render(
      <MemoryRouter initialEntries={['/tai-khoan/thong-tin-ca-nhan?tab=profile']}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route element={<AuthGuard loginPath="/login" />}>
            <Route path="/tai-khoan/thong-tin-ca-nhan" element={<p>Private page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders protected content for an authenticated session', () => {
    useSession.mockReturnValue({ loading: false, isAuthenticated: true })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/protected" element={<p>Private page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Private page')).toBeInTheDocument()
  })
})
